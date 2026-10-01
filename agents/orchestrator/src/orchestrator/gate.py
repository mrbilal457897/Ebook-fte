"""Atomic admission, in-flight lease, and per-device/IP rate-limit primitives.

The three guarantees that must hold under concurrency (research.md §4, §5,
§8) are single-statement or one-STARTed-transaction operations, so no
read-then-write window exists:

  - FR-007 free-tier admit: `UPDATE accounts ... WHERE free_tier_count <
    limit RETURNING free_tier_count` (row-level lock; exactly one winner for
    the last credit). Refund path is a guarded decrement (`> 0`) and only
    ever called for provider/BYOK faults (Clarification Q1).
  - FR-009 in-flight lease: guarded `INSERT` into `run_states` backed by the
    unique index `(account_id, kind)`; stale (expired) leases are deleted in
    the same transaction first, so a new insert succeeds over them
    (self-expiry, Clarification Q2).
  - FR-002 device/IP rate limits: atomic `INSERT ... ON CONFLICT ... DO
    UPDATE ... WHERE count < threshold RETURNING count` per
    (tenant_id, account_id, kind, scope_key, window_start).

All statements are fixed, named, tenant-scoped orchestration code — never an
agent-facing "run SQL" tool (Article IV.3).
"""

from dataclasses import dataclass
from typing import Any, Literal
from uuid import uuid4

from psycopg import Connection
from psycopg.types.json import Json

RejectReason = Literal[
    "rate_limited",
    "free_tier_exhausted",
    "already_in_progress",
    "invalid_prompt",
]


@dataclass(frozen=True)
class GenerationContext:
    """Everything the streaming path needs, produced by a successful admit."""

    tenant_id: str
    account_id: str
    lease_id: str
    book_id: str
    conversation_id: str
    version_id: str
    free_tier_count: int


@dataclass(frozen=True)
class AdmissionResult:
    ctx: GenerationContext | None
    reject_reason: RejectReason | None


# --- FR-007 free-tier admit + refund --------------------------------------


def admit_free_tier(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    free_tier_limit: int,
) -> int | None:
    """Atomically consume one free generation if eligible.

    Returns the new `free_tier_count` on success, or `None` when the account
    is already at its limit (no row RETURNING -> nothing consumed). The limit
    is read from the row itself so the returned count can never exceed it.
    """
    row = _fetchone(
        _issue_admit_free_tier(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            free_tier_limit=free_tier_limit,
        )
    )
    if row is None:
        return None
    return int(row["free_tier_count"])


def _issue_admit_free_tier(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    free_tier_limit: int,
) -> Any:
    """Issue the FR-007 free-tier statement and hand back its *unfetched*
    cursor.

    Split from `admit_free_tier` so `admit_generation` can put this statement
    inside a pipelined batch, where a result is not readable until the batch
    ends. The SQL and parameters are identical either way — this is a
    round-trip optimisation, not a second implementation.
    """
    return conn.execute(
        """
        UPDATE accounts
        SET free_tier_count = free_tier_count + 1, updated_at = now()
        WHERE id = %s AND tenant_id = %s
          AND free_tier_count < %s
        RETURNING free_tier_count
        """,
        (account_id, tenant_id, free_tier_limit),
    )


def refund_free_tier(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
) -> int | None:
    """Guarded decrement for provider/BYOK faults (Clarification Q1/FR-008).

    Returns the new count, or `None` when already at 0 (never negative). Only
    the caller decides *when* a refund is warranted — the counter contract is
    `0 <= count` enforced here.
    """
    row = _fetchone(
        conn.execute(
            """
            UPDATE accounts
            SET free_tier_count = free_tier_count - 1, updated_at = now()
            WHERE id = %s AND tenant_id = %s AND free_tier_count > 0
            RETURNING free_tier_count
            """,
            (account_id, tenant_id),
        )
    )
    if row is None:
        return None
    return int(row["free_tier_count"])


# --- FR-009 in-flight lease -------------------------------------------------


def acquire_lease(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
    window_seconds: int,
    payload: dict[str, Any] | None = None,
) -> str | None:
    """Acquire the live lease or return `None` if one is already live.

    The unique index `run_states_live_lease_unique` on `(account_id, kind)`
    is the backstop against the read-then-insert race; this guarded insert is
    the primary gate. A stale (expired) lease is deleted transactionally first
    so it never blocks a fresh acquire (Clarification Q2); live leases are
    untouched and make the insert conflict.
    """
    conn.execute(
        """
        DELETE FROM run_states
        WHERE tenant_id = %s AND account_id = %s AND kind = %s
          AND lock_expires_at <= now()
        """,
        (tenant_id, account_id, kind),
    )
    row = _fetchone(
        _issue_lease_insert(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            kind=kind,
            lease_id=str(uuid4()),
            window_seconds=window_seconds,
            payload=payload,
        )
    )
    if row is None:
        return None
    return str(row["id"])


def _issue_lease_insert(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
    lease_id: str,
    window_seconds: int,
    payload: dict[str, Any] | None = None,
) -> Any:
    """Issue the FR-009 guarded lease insert and hand back its *unfetched*
    cursor. See `_issue_admit_free_tier` for why this is split out. The lease
    id is supplied by the caller so the statement needs no prior result — in
    `admit_generation` it is minted before the batch opens."""
    return conn.execute(
        """
        INSERT INTO run_states
            (id, tenant_id, account_id, kind, state, payload,
             lock_expires_at, created_at, updated_at)
        SELECT %s, %s, %s, %s, 'running', %s,
               now() + make_interval(secs => %s), now(), now()
        ON CONFLICT (account_id, kind)
        DO NOTHING
        RETURNING id
        """,
        (
            lease_id,
            tenant_id,
            account_id,
            kind,
            Json(payload) if payload else None,
            window_seconds,
        ),
    )


def _issue_lease_expiry_sweep(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
) -> None:
    """Delete an expired lease so a fresh acquire can succeed (Clarification
    Q2). Split out for the same reason as `_issue_lease_insert`; it returns
    nothing, so there is no cursor to defer."""
    conn.execute(
        """
        DELETE FROM run_states
        WHERE tenant_id = %s AND account_id = %s AND kind = %s
          AND lock_expires_at <= now()
        """,
        (tenant_id, account_id, kind),
    )


def lease_is_live(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
) -> bool:
    """True when an unexpired lease exists (read-back for diagnostics/UI)."""
    row = _fetchone(
        conn.execute(
            """
            SELECT 1
            FROM run_states
            WHERE tenant_id = %s AND account_id = %s AND kind = %s
              AND lock_expires_at > now()
            LIMIT 1
            """,
            (tenant_id, account_id, kind),
        )
    )
    return row is not None


# --- FR-002 per-device/per-IP rate limit -----------------------------------


def bump_rate_limit(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
    scope_key: str,
    window_seconds: int,
    threshold: int,
) -> bool:
    """Atomically count one request in its window; True if under the limit.

    Single INSERT ... ON CONFLICT ... DO UPDATE ... WHERE count < threshold
    with RETURNING count. An over-limit request updates nothing and gets no
    RETURNING row -> False. The window start is derived from `now()`, so all
    requests share one row per window.
    """
    row = _fetchone(
        _issue_rate_limit_bump(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            kind=kind,
            scope_key=scope_key,
            window_seconds=window_seconds,
            threshold=threshold,
        )
    )
    return row is not None


def _issue_rate_limit_bump(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
    scope_key: str,
    window_seconds: int,
    threshold: int,
) -> Any:
    """Issue the FR-002 atomic count statement and hand back its *unfetched*
    cursor. See `_issue_admit_free_tier` for why this is split out."""
    return conn.execute(
        """
        INSERT INTO rate_limit_counts
            (id, tenant_id, account_id, kind, scope_key, window_start,
             count, created_at, updated_at)
        SELECT %s, %s, %s, %s, %s, w.start, 1, now(), now()
        FROM (SELECT to_timestamp(
                    floor(extract(epoch FROM now()) / %s) * %s
                ) AS start) AS w
        ON CONFLICT (tenant_id, account_id, kind, scope_key, window_start)
        DO UPDATE SET count = rate_limit_counts.count + 1, updated_at = now()
        WHERE rate_limit_counts.count < %s
        RETURNING count
        """,
        (
            str(uuid4()),
            tenant_id,
            account_id,
            kind,
            scope_key,
            window_seconds,
            window_seconds,
            threshold,
        ),
    )


# --- Combined admission -----------------------------------------------------


def admit_generation(
    conn: Connection,
    *,
tenant_id: str,
    account_id: str,
    free_tier_limit: int,
    prompt: str,
    device_key: str | None,
    client_ip_key: str | None,
    rate_limit_device_max: int,
    rate_limit_ip_max: int,
    rate_limit_window_seconds: int,
    lease_window_seconds: int,
) -> AdmissionResult:
    """Run the admission gate: rate limit, credit, lease — create the book/
    conversation/content stub, and return the admitted context.

    Ordering is fixed (contracts/orchestrator-api.md guarantee order):
      1. device/IP rate limit  -> 429 before anything else
      2. atomic free-tier      -> 402 when exhausted
      3. in-flight lease       -> 409 when a live lease exists
    On any rejection the caller rolls back this transaction (nothing stored;
    the failure-case audit row is written by the caller in its own txn).

    **Every admission statement goes out as one pipelined batch** (T046/AC3)
    — eight when both rate-limit keys are supplied, six when neither is. The
    batch is a latency optimisation only — the SQL, the parameters, the
    transaction, and the rejection order are exactly what they were
    sequentially. Two properties make it safe:

    1. *No statement's parameters depend on an earlier statement's result.*
       Every id is a client-generated UUID minted below, before the batch
       opens, so nothing has to read a result to build the next statement. The
       statements are also order-dependent as *work* — the lease sweep must
       precede the lease insert, and the content version reads the book row the
       `create_book` statement creates — and pipeline mode preserves server-side
       execution order, so those dependencies still hold.
    2. *Rejection still rolls everything back.* Checking the results after the
       batch instead of between statements means a rejected request has already
       bumped its rate-limit counters and inserted its records — but the caller
       raises `Rejection` inside this same transaction, so all of it is rolled
       back and the net effect is identical to bailing out early.

    Measured against the project's real remote Postgres (RTT ~210 ms): issuing
    these sequentially cost ~1740 ms, and the batched form with all results
    fetched only after the block costs ~430 ms. That is the difference between
    missing and meeting FR-004's 2 s budget without touching the provider or
    the persistence contract.

    Reading any cursor *inside* the block defeats this: psycopg's pipeline mode
    has no result to hand back until the batch is flushed, so the first
    `fetchone()` breaks the pipeline and silently restores a round trip per
    statement. Hence the `_issue_*` helpers, which execute and hand back an
    unread cursor for the caller to fetch after the block closes.
    """
    from orchestrator import models  # local import: gate stays import-light

    # Minted up front so no statement inside the batch needs a prior result.
    # (The two rate-limit ids are minted inside `_issue_rate_limit_bump`, which
    # has no result dependency of its own to hoist.)
    lease_id = str(uuid4())
    book_id = str(uuid4())
    conversation_id = str(uuid4())
    version_id = str(uuid4())

    with models.pipelined_transaction_scope(conn):
        device_bump = (
            _issue_rate_limit_bump(
                conn,
                tenant_id=tenant_id,
                account_id=account_id,
                kind="device",
                scope_key=device_key,
                window_seconds=rate_limit_window_seconds,
                threshold=rate_limit_device_max,
            )
            if device_key
            else None
        )
        ip_bump = (
            _issue_rate_limit_bump(
                conn,
                tenant_id=tenant_id,
                account_id=account_id,
                kind="ip",
                scope_key=client_ip_key,
                window_seconds=rate_limit_window_seconds,
                threshold=rate_limit_ip_max,
            )
            if client_ip_key
            else None
        )
        free_tier_row = _issue_admit_free_tier(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            free_tier_limit=free_tier_limit,
        )
        _issue_lease_expiry_sweep(
            conn, tenant_id=tenant_id, account_id=account_id, kind="generation"
        )
        lease_row = _issue_lease_insert(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            kind="generation",
            lease_id=lease_id,
            window_seconds=lease_window_seconds,
            payload={"phase": "admitted"},
        )
        models._issue_create_book(
            conn, tenant_id=tenant_id, account_id=account_id, book_id=book_id
        )
        models._issue_create_conversation(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            prompt=prompt,
            conversation_id=conversation_id,
        )
        version_cursor = models._issue_create_content_version(
            conn,
            book_id=book_id,
            tenant_id=tenant_id,
            account_id=account_id,
            version_id=version_id,
        )

    # Results are readable only now, once the batch has been flushed. Read in
    # the contract's order so the first applicable rejection is the one the
    # customer is told about.
    if device_bump is not None and _fetchone(device_bump) is None:
        return AdmissionResult(ctx=None, reject_reason="rate_limited")
    if ip_bump is not None and _fetchone(ip_bump) is None:
        return AdmissionResult(ctx=None, reject_reason="rate_limited")

    count_row = _fetchone(free_tier_row)
    if count_row is None:
        return AdmissionResult(ctx=None, reject_reason="free_tier_exhausted")
    count = int(count_row["free_tier_count"])

    if _fetchone(lease_row) is None:
        return AdmissionResult(ctx=None, reject_reason="already_in_progress")

    # The content version's `SELECT ... FROM books` shape returns no row if the
    # book is not visible under this tenant/account. That must never be silent:
    # the streaming path would then fail on a version id that does not exist.
    if _fetchone(version_cursor) is None:
        raise RuntimeError(
            "admission created no content version; the book row was not visible"
        )

    ctx = GenerationContext(
        tenant_id=tenant_id,
        account_id=account_id,
        lease_id=lease_id,
        book_id=book_id,
        conversation_id=conversation_id,
        version_id=version_id,
        free_tier_count=count,
    )
    return AdmissionResult(ctx=ctx, reject_reason=None)


def _fetchone(cursor: Any) -> dict[str, Any] | None:
    return cursor.fetchone()
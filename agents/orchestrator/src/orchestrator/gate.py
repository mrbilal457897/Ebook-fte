"""Atomic admission, in-flight lease, and per-device/IP rate-limit primitives.

The three guarantees that must hold under concurrency (research.md §4, §5,
§8) are single-statement or one-STARTed-transaction operations, so no
read-then-write window exists:

  - FR-007 free-tier admit: `UPDATE accounts ... WHERE free_tier_count <
    limit RETURNING free_tier_count` (row-level lock; exactly one winner for
    the last credit). Refund path is a guarded decrement (`> 0`) and only
    ever called for provider/BYOK faults (Clarification Q1).
  - FR-009 in-flight lease: guarded `INSERT` into `run_states` backed by the
    partial unique index `(account_id, kind) WHERE lock_expires_at > now()`;
    expired leases leave the uniqueness scope and a new insert succeeds
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
        conn.execute(
            """
            UPDATE accounts
            SET free_tier_count = free_tier_count + 1, updated_at = now()
            WHERE id = %s AND tenant_id = %s
              AND free_tier_count < %s
            RETURNING free_tier_count
            """,
            (account_id, tenant_id, free_tier_limit),
        )
    )
    if row is None:
        return None
    return int(row["free_tier_count"])


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

    The partial unique index `run_states_live_lease_unique` on
    `(account_id, kind) WHERE lock_expires_at > now()` is the backstop against
    the read-then-insert race; this guarded insert is the primary gate.
    """
    row = _fetchone(
        conn.execute(
            """
            INSERT INTO run_states
                (id, tenant_id, account_id, kind, state, payload,
                 lock_expires_at, created_at, updated_at)
            SELECT %s, %s, %s, %s, 'running', %s,
                   now() + make_interval(secs => %s), now(), now()
            ON CONFLICT (account_id, kind) WHERE lock_expires_at > now()
            DO NOTHING
            RETURNING id
            """,
            (str(uuid4()), tenant_id, account_id, kind, Json(payload) if payload else None, window_seconds),
        )
    )
    if row is None:
        return None
    return str(row["id"])


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
        conn.execute(
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
    )
    return row is not None


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
    """
    if device_key and not bump_rate_limit(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        kind="device",
        scope_key=device_key,
        window_seconds=rate_limit_window_seconds,
        threshold=rate_limit_device_max,
    ):
        return AdmissionResult(ctx=None, reject_reason="rate_limited")

    if client_ip_key and not bump_rate_limit(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        kind="ip",
        scope_key=client_ip_key,
        window_seconds=rate_limit_window_seconds,
        threshold=rate_limit_ip_max,
    ):
        return AdmissionResult(ctx=None, reject_reason="rate_limited")

    count = admit_free_tier(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        free_tier_limit=free_tier_limit,
    )
    if count is None:
        return AdmissionResult(ctx=None, reject_reason="free_tier_exhausted")

    lease_id = acquire_lease(
        conn,
        tenant_id=tenant_id,
        account_id=account_id,
        kind="generation",
        window_seconds=lease_window_seconds,
        payload={"phase": "admitted"},
    )
    if lease_id is None:
        return AdmissionResult(ctx=None, reject_reason="already_in_progress")

    from orchestrator import models  # local import: gate stays import-light

    book_id = models.create_book(conn, tenant_id=tenant_id, account_id=account_id)
    conversation_id = models.create_conversation(
        conn, tenant_id=tenant_id, account_id=account_id, prompt=prompt
    )
    version_id = models.create_content_version(
        conn,
        book_id=book_id,
        tenant_id=tenant_id,
        account_id=account_id,
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
"""Postgres access layer for the Orchestrator.

Fixed, named, tenant-scoped statements only — this is orchestration code,
not an agent tool (Constitution Article IV.3; no run-arbitrary-SQL tool).
Every query takes `tenant_id` (and `account_id` where the row is per-account)
and enforces it in the WHERE clause; `tenant_id` is always derived from the
authenticated session at the boundary, never from model text (Article IV.5).
"""

import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, cast

from psycopg import Connection, Cursor
from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool

from orchestrator import config

_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            config.get_settings().database_url,
            kwargs={"row_factory": dict_row},
        )
        _pool.open()
    return _pool


@contextmanager
def transaction() -> Iterator[Connection]:
    """Yield an open connection with a live transaction (committed on exit,
    rolled back on exception)."""
    with _get_pool().connection() as conn, conn.transaction():
        yield conn


@contextmanager
def pipelined_transaction_scope(conn: Connection) -> Iterator[Connection]:
    """Batch the statements issued inside this block into one round trip, on a
    connection whose transaction is already open by the caller.

    This is the same optimisation as `pipelined_transaction`, split so it can be
    used from inside a larger transaction — `gate.admit_generation` runs within
    the admission+BYOK transaction and must not open a second one. It does not
    commit or roll back anything: the owning `transaction()` still does that,
    and an exception inside this block propagates to it unchanged.

    **Nothing may fetch inside the block.** psycopg resolves a fetch during a
    pipeline by flushing and ending the pipeline
    (`Cursor._fetch_pipeline` -> `Pipeline._fetch_gen(flush=True)`), so a single
    premature `fetchone()` costs a full network round trip and undoes the batch.
    Collect the unfetched cursors from the `_issue_*` helpers and read them
    after the block exits. Measured (T046/AC3, real remote Postgres at ~220 ms
    RTT): admission issued as one batch with all fetches deferred took ~250 ms;
    the same batch with three fetches inside it took ~1050 ms.

    Like `pipelined_transaction`, this is a latency optimisation only. Atomicity,
    ordering, and rollback behaviour all belong to the enclosing transaction and
    are unchanged.
    """
    if not hasattr(conn, "pipeline"):
        # No pipeline support (a test double). Run statements as issued.
        yield conn
        return
    with conn.pipeline():
        yield conn


@contextmanager
def pipelined_transaction() -> Iterator[Connection]:
    """Like `transaction()`, but batch the statements sent inside it into as few
    network round trips as possible (`psycopg` pipeline mode).

    Why this exists (T046, AC3/FR-004). Every stage of a generation is a
    database round trip, and against a remote Postgres one round trip is
    ~220 ms (measured; T046). The first-token budget is 2 s. The admission
    transaction issues *eight* statements, and `psycopg`'s default mode waits
    for a result after each one — so admission alone cost ~2.5 s of pure
    waiting, which is what actually blew the 2 s budget. Merging the admission
    and BYOK transactions (earlier in T046) did not help much, because it
    reduced the number of *transactions*, not the number of *statements*.

    Pipeline mode sends every statement in the block in one flush and collects
    the results at the end, so the same eight statements cost one round trip
    (~0.7 s measured) instead of eight (~2.5 s). Transactional semantics are
    unchanged: the block is still a single transaction that commits on clean
    exit and rolls back on any exception, and the server still executes the
    statements in the order they were sent.

    **The constraint that matters:** a statement's *parameters* cannot depend on
    a previous statement's *result* while inside the block, because results are
    not available until the block ends. Any such dependency must be lifted out
    (generate the id client-side) or split across two blocks. Anything that
    gates on a `RETURNING` value — the free-tier check, the lease insert, the
    rate-limit bump — has to read its result before deciding what to do next,
    so those stay outside the block in `gate.admit_generation`.

    Degrades to plain sequential behaviour if the connection does not support
    pipeline mode, so correctness never depends on this being supported.
    """
    with _get_pool().connection() as conn, conn.transaction():
        # Support is checked up front, never by catching an exception around the
        # `yield`: a `TypeError` raised by the caller's own code must not be
        # mistaken for "no pipeline support", which would re-yield the
        # connection and commit it twice.
        if not hasattr(conn, "pipeline"):
            yield conn
            return
        with conn.pipeline():
            yield conn


def fetchone(cursor: Cursor) -> dict[str, Any] | None:
    """Typed fetchone for the dict_row factory (pyright-friendly)."""
    return cast(dict[str, Any] | None, cursor.fetchone())


def _resolved_id(cursor: Any) -> str:
    """Fetch a `RETURNING id` cursor and return the id.

    Every `create_*` below is "insert and hand back the new id", and every one
    of them must produce a row — a missing `RETURNING` means the INSERT's
    `SELECT` shape matched nothing, which is a bug, not an expected outcome. So
    the assertion is uniform rather than repeated per function.
    """
    row = fetchone(cursor)
    assert row is not None, "insert returned no id"
    return str(row["id"])


def fetchall(cursor: Cursor) -> list[dict[str, Any]]:
    """Typed fetchall for the dict_row factory (pyright-friendly)."""
    return cast(list[dict[str, Any]], cursor.fetchall())


def _new_id() -> str:
    return str(uuid.uuid4())


def record_invocation(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    agent: str,
    action: str,
    inputs: dict[str, Any],
    output: dict[str, Any],
    latency_ms: int,
    success: bool,
) -> str:
    row = fetchone(
        conn.execute(
            """
            INSERT INTO capability_invocations
                (id, tenant_id, account_id, agent, action, inputs, output,
                 latency_ms, cost, success, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s, now())
            RETURNING id
            """,
            (
                _new_id(),
                tenant_id,
                account_id,
                agent,
                action,
                Json(inputs),
                Json(output),
                latency_ms,
                success,
            ),
        )
    )
    assert row is not None
    return str(row["id"])


def record_audit(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    agent: str,
    action: str,
    inputs: dict[str, Any],
    output: dict[str, Any],
    status: str,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_log
            (id, tenant_id, account_id, agent, action, inputs, output,
             timestamp, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, now(), %s)
        """,
        (
            _new_id(),
            tenant_id,
            account_id,
            agent,
            action,
            Json(inputs),
            Json(output),
            status,
        ),
    )


def latency_ms(started: float) -> int:
    return max(1, round((time.perf_counter() - started) * 1000))


# --- Books --------------------------------------------------------------
# Book creation is incidental on first generation (data-model.md); no
# book-management UI exists in this slice.


def create_book(
    conn: Connection, *, tenant_id: str, account_id: str, book_id: str | None = None
) -> str:
    """Create the incidental book row (data-model.md).

    `book_id` may be supplied by the caller so this can run inside a pipelined
    batch alongside the other record creations, where a result is not yet
    available to feed the next statement's parameters. The id is the same either
    way — a client-generated UUID, not a database sequence.
    """
    return _resolved_id(
        _issue_create_book(
            conn, tenant_id=tenant_id, account_id=account_id, book_id=book_id
        )
    )


def _issue_create_book(
    conn: Connection, *, tenant_id: str, account_id: str, book_id: str | None = None
) -> Any:
    """Issue the `books` insert and hand back its *unfetched* cursor.

    **Do not fetch inside a `pipelined_transaction_scope` block.** psycopg
    resolves a fetch inside a pipeline by flushing and ending the pipeline
    (`Cursor._fetch_pipeline` -> `Pipeline._fetch_gen(flush=True)`), which costs
    a full network round trip — exactly what the batch exists to avoid. Callers
    that batch must collect these cursors and fetch them after the block exits.
    Measured (T046/AC3, real remote Postgres at ~220 ms RTT): fetching inside
    the block turned a single-round-trip admission into roughly five.
    """
    return conn.execute(
        """
        INSERT INTO books (id, tenant_id, account_id, status, created_at,
                           updated_at)
        VALUES (%s, %s, %s, 'draft', now(), now())
        RETURNING id
        """,
        (book_id or _new_id(), tenant_id, account_id),
    )


def get_book(
    conn: Connection, *, book_id: str, tenant_id: str, account_id: str
) -> dict[str, Any] | None:
    return fetchone(
        conn.execute(
            """
            SELECT id, status FROM books
            WHERE id = %s AND tenant_id = %s AND account_id = %s
            """,
            (book_id, tenant_id, account_id),
        )
    )


# --- Conversations -------------------------------------------------------


def create_conversation(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    prompt: str,
    conversation_id: str | None = None,
) -> str:
    """Create the conversation row.

    `conversation_id` may be supplied so this can run inside a pipelined batch
    alongside `create_book` and `create_content_version`, where a result is not
    yet available to feed the next statement's parameters (see `create_book`).
    """
    return _resolved_id(
        _issue_create_conversation(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            prompt=prompt,
            conversation_id=conversation_id,
        )
    )


def _issue_create_conversation(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    prompt: str,
    conversation_id: str | None = None,
) -> Any:
    """Issue the `conversations` insert and hand back its *unfetched* cursor.
    See `_issue_create_book` for why a batched caller must not fetch here."""
    return conn.execute(
        """
        INSERT INTO conversations (id, tenant_id, account_id, title,
                                   summary, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, now(), now())
        RETURNING id
        """,
        (
            conversation_id or _new_id(),
            tenant_id,
            account_id,
            prompt[:200],
            prompt[:200],
        ),
    )


# --- Content versions ----------------------------------------------------
# Additive versioning: one row per (book_id, version_num); a version is
# appended to in place during streaming (FR-005), created partial and flipped
# false at terminal state.


def create_content_version(
    conn: Connection,
    *,
    book_id: str,
    tenant_id: str,
    account_id: str,
    version_id: str | None = None,
) -> str:
    """Create the partial version row (FR-005). `version_id` may be supplied so
    this can run inside a pipelined batch (see `create_book`)."""
    return _resolved_id(
        _issue_create_content_version(
            conn,
            book_id=book_id,
            tenant_id=tenant_id,
            account_id=account_id,
            version_id=version_id,
        )
    )


def _issue_create_content_version(
    conn: Connection,
    *,
    book_id: str,
    tenant_id: str,
    account_id: str,
    version_id: str | None = None,
) -> Any:
    """Issue the `content_versions` insert and hand back its *unfetched*
    cursor. See `_issue_create_book` for why a batched caller must not fetch
    here.

    The `SELECT ... FROM books` shape is load-bearing: it derives `version_num`
    from the book's existing versions and returns **no row** if the book does
    not exist under this tenant/account. Pipeline mode preserves server-side
    execution order, so the book row created by the earlier statement in the
    same batch is visible here — but the caller must still check the result
    after the block rather than assume it.
    """
    return conn.execute(
        """
        INSERT INTO content_versions
            (id, book_id, tenant_id, account_id, version_num, content,
             is_partial, created_at, updated_at)
        SELECT %s, b.id, b.tenant_id, b.account_id,
               COALESCE(MAX(cv.version_num), 0) + 1,
               '', true, now(), now()
        FROM books b
        LEFT JOIN content_versions cv
            ON cv.book_id = b.id AND cv.tenant_id = b.tenant_id
               AND cv.account_id = b.account_id
        WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
        GROUP BY b.id
        RETURNING id
        """,
        (version_id or _new_id(), book_id, tenant_id, account_id),
    )


def get_content_version(
    conn: Connection,
    *,
    version_id: str,
    tenant_id: str,
    account_id: str,
) -> dict[str, Any] | None:
    return fetchone(
        conn.execute(
            """
            SELECT id, book_id, tenant_id, account_id, version_num, content,
                   is_partial, updated_at
            FROM content_versions
            WHERE id = %s AND tenant_id = %s AND account_id = %s
            """,
            (version_id, tenant_id, account_id),
        )
    )


def append_content(
    conn: Connection,
    *,
    version_id: str,
    tenant_id: str,
    account_id: str,
    delta: str,
) -> None:
    conn.execute(
        """
        UPDATE content_versions
        SET content = content || %s, updated_at = now()
        WHERE id = %s AND tenant_id = %s AND account_id = %s
        """,
        (delta, version_id, tenant_id, account_id),
    )


def finalize_content_version(
    conn: Connection,
    *,
    version_id: str,
    tenant_id: str,
    account_id: str,
) -> None:
    conn.execute(
        """
        UPDATE content_versions
        SET is_partial = false, updated_at = now()
        WHERE id = %s AND tenant_id = %s AND account_id = %s
        """,
        (version_id, tenant_id, account_id),
    )


# --- Accounts -----------------------------------------------------------
# Free-tier field reads; the atomic admit/refund lives in gate.py (FR-007),
# not here, because it must be one statement with the eligibility check.


def get_account(
    conn: Connection, *, tenant_id: str, account_id: str
) -> dict[str, Any] | None:
    return fetchone(
        conn.execute(
            """
            SELECT id, email, free_tier_count, free_tier_limit,
                   active_byok_credential_id
            FROM accounts
            WHERE id = %s AND tenant_id = %s
            """,
            (account_id, tenant_id),
        )
    )


# --- Model credentials --------------------------------------------------
# BYOK provider + key lookup; keys are encrypted at rest and decrypted
# in-memory only for the request duration (Article VII.2). Never log the key.


def get_model_credential(
    conn: Connection,
    *,
    credential_id: str,
    tenant_id: str,
    account_id: str | None,
) -> dict[str, Any] | None:
    return fetchone(
        conn.execute(
            """
            SELECT id, provider, encrypted_key, last_status
            FROM model_credentials
            WHERE id = %s AND tenant_id = %s
              AND (%s::uuid IS NULL OR account_id = %s)
            """,
            (credential_id, tenant_id, account_id, account_id),
        )
    )


# --- Run states (lease) -------------------------------------------------
# Lease primitives deliberately live in gate.py with the atomic admit so the
# free-tier + in-flight guarantees are one coherent code path (T013); the
# read/poke helpers below are what persistence needs (T032).


def get_live_lease(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    kind: str,
) -> dict[str, Any] | None:
    return fetchone(
        conn.execute(
            """
            SELECT id, state, payload, lock_expires_at
            FROM run_states
            WHERE tenant_id = %s AND account_id = %s AND kind = %s
              AND lock_expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (tenant_id, account_id, kind),
        )
    )


def renew_lease(
    conn: Connection,
    *,
    lease_id: str,
    tenant_id: str,
    account_id: str,
    window_seconds: int,
) -> None:
    conn.execute(
        """
        UPDATE run_states
        SET lock_expires_at = now() + make_interval(secs => %s),
            updated_at = now()
        WHERE id = %s AND tenant_id = %s AND account_id = %s
        """,
        (window_seconds, lease_id, tenant_id, account_id),
    )


def release_lease(
    conn: Connection,
    *,
    lease_id: str,
    tenant_id: str,
    account_id: str,
) -> None:
    conn.execute(
        """
        UPDATE run_states
        SET lock_expires_at = now(), updated_at = now()
        WHERE id = %s AND tenant_id = %s AND account_id = %s
        """,
        (lease_id, tenant_id, account_id),
    )


# --- Rate limit counts (FR-002) -----------------------------------------
# The atomic check-and-increment is one statement on INSERT ... ON CONFLICT;
# gate.py owns that statement (T016). This helper is what the read-back /
# diagnostics paths need.


def prune_stale_rate_limit_windows(
    conn: Connection,
    *,
    window_seconds: int,
) -> None:
    conn.execute(
        """
        DELETE FROM rate_limit_counts
        WHERE window_start < now() - make_interval(secs => %s)
        """,
        (window_seconds,),
    )
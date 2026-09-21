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
            config.DATABASE_URL,
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


def fetchone(cursor: Cursor) -> dict[str, Any] | None:
    """Typed fetchone for the dict_row factory (pyright-friendly)."""
    return cast(dict[str, Any] | None, cursor.fetchone())


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
    conn: Connection, *, tenant_id: str, account_id: str
) -> str:
    row = fetchone(
        conn.execute(
            """
            INSERT INTO books (id, tenant_id, account_id, status, created_at,
                               updated_at)
            VALUES (%s, %s, %s, 'draft', now(), now())
            RETURNING id
            """,
            (_new_id(), tenant_id, account_id),
        )
    )
    assert row is not None
    return str(row["id"])


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
    conn: Connection, *, tenant_id: str, account_id: str, prompt: str
) -> str:
    row = fetchone(
        conn.execute(
            """
            INSERT INTO conversations (id, tenant_id, account_id, title,
                                       summary, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, now(), now())
            RETURNING id
            """,
            (_new_id(), tenant_id, account_id, prompt[:200], prompt[:200]),
        )
    )
    assert row is not None
    return str(row["id"])


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
    prompt: str,
) -> str:
    row = fetchone(
        conn.execute(
            """
            INSERT INTO content_versions
                (id, book_id, tenant_id, account_id, version_num, content,
                 is_partial, created_at, updated_at)
            SELECT %s, b.id, b.tenant_id, b.account_id,
                   COALESCE(MAX(cv.version_num), 0) + 1,
                   %s, true, now(), now()
            FROM books b
            LEFT JOIN content_versions cv
                ON cv.book_id = b.id AND cv.tenant_id = b.tenant_id
                   AND cv.account_id = b.account_id
            WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
            GROUP BY b.id
            RETURNING id
            """,
            (_new_id(), prompt, book_id, tenant_id, account_id),
        )
    )
    assert row is not None
    return str(row["id"])


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
              AND (%s IS NULL OR account_id = %s)
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
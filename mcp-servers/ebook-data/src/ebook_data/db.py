"""Postgres access for ebook-data.

Parameterized queries only — no raw SQL is ever assembled from tool arguments
(Constitution Article IV.3; AGENTS.md §7). Every write inserts its
capability_invocations + audit_log rows in the same transaction (Article VIII).
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

from ebook_data import config

_pool: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            config.DATABASE_URL,
            min_size=config.POOL_MIN,
            max_size=config.POOL_MAX,
            open=False,
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


def record_invocation(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
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
                str(uuid.uuid4()),
                tenant_id,
                account_id,
                config.AGENT_NAME,
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
            str(uuid.uuid4()),
            tenant_id,
            account_id,
            config.AGENT_NAME,
            action,
            Json(inputs),
            Json(output),
            status,
        ),
    )


def latency_ms(started: float) -> int:
    return max(1, round((time.perf_counter() - started) * 1000))
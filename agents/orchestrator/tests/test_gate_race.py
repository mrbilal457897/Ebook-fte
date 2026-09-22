"""T012 — free-tier counter race (FR-007, AC2 part).

Written FIRST (TDD): fails until gate.py's atomic admit exists. Fires
`admit_free_tier` concurrently from separate connections and asserts:
  - exactly `free_tier_limit` admits succeed (never more),
  - the counter reads exactly `limit` afterwards (never more),
  - refunds never drive the counter below 0.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
import pytest
from conftest import seed_account
from psycopg import Connection
from psycopg.rows import dict_row

from orchestrator import gate


def _admit_thread(
    dsn: str, tenant_id: str, account_id: str
) -> int | None:
    """One admits free-tier credit in its own connection/txn."""
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    with conn:
        return gate.admit_free_tier(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            free_tier_limit=3,
        )


def _admitted(results: list[Any]) -> list[int]:
    return [r.result() for r in results if r.result() is not None]


@pytest.mark.usefixtures("dsn", "db")
def test_four_concurrent_admits_exactly_three_succeed(dsn: str, db: Any) -> None:
    acct = seed_account(db, free_tier_limit=3)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [
            pool.submit(_admit_thread, dsn, acct["tenant_id"], acct["account_id"])
            for _ in range(4)
        ]
    admitted = _admitted(results)

    assert len(admitted) == 3, f"expected exactly 3 admits, got {len(admitted)}"
    assert admitted == sorted(admitted), "returned counts must equal the written counts"

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s AND tenant_id = %s",
            (acct["account_id"], acct["tenant_id"]),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["free_tier_count"] == 3, "counter must read 3 after 3 admits, never 4"


@pytest.mark.usefixtures("dsn", "db")
def test_concurrent_race_for_last_credit_admits_exactly_one(dsn: str, db: Any) -> None:
    acct = seed_account(db, free_tier_limit=3, free_tier_count=2)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [
            pool.submit(_admit_thread, dsn, acct["tenant_id"], acct["account_id"])
            for _ in range(8)
        ]
    admitted = _admitted(results)

    assert len(admitted) == 1, (
        "exactly one request may win the last credit, "
        f"got {len(admitted)} admitted"
    )
    assert admitted == [3]

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s",
            (acct["account_id"],),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["free_tier_count"] == 3, "counter must never exceed 3"


@pytest.mark.usefixtures("dsn", "db")
def test_admit_rejects_at_limit_without_writing(dsn: str, db: Any) -> None:
    acct = seed_account(db, free_tier_limit=3, free_tier_count=3)
    outcome = _admit_thread(dsn, acct["tenant_id"], acct["account_id"])
    assert outcome is None, "admit must return None (no row) at the limit"

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s",
            (acct["account_id"],),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["free_tier_count"] == 3, "blocked attempt must not consume credit"


@pytest.mark.usefixtures("dsn", "db")
def test_refund_decrements_and_never_goes_negative(dsn: str, db: Any) -> None:
    acct = seed_account(db, free_tier_limit=3, free_tier_count=1)
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    with conn:
        refunded = gate.refund_free_tier(
            conn,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
        )
    assert refunded == 0, "1 -> 0 after one refund"

    conn2: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn2.row_factory = dict_row
    with conn2:
        second = gate.refund_free_tier(
            conn2,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
        )
    assert second is None, "refund below 0 must not write"

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s",
            (acct["account_id"],),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["free_tier_count"] == 0, "counter must never go negative"
"""T038 — near-simultaneous race for the LAST free credit (FR-007, AC2).

Written FIRST (TDD). Unlike test_gate_race (which races just the counter),
this races the FULL admission path (`gate.admit_generation`: rate limit
+ atomic credit + in-flight lease + stubs) from separate connections, eight
requests hitting an account at 2/3 used. Exactly one must win the last
credit; the counter must read exactly 3 afterwards and never exceed it.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
import pytest
from conftest import seed_account
from psycopg import Connection
from psycopg.rows import dict_row

from orchestrator import gate

WINDOW = 60


def _admit_thread(
    dsn: str, tenant_id: str, account_id: str, i: int
) -> str | None:
    """Full admission for request #i in its own connection/txn."""
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    with conn:
        result = gate.admit_generation(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            free_tier_limit=3,
            prompt=f"race book {i}",
            device_key=f"device-{i}",
            client_ip_key=None,
            rate_limit_device_max=100,
            rate_limit_ip_max=100,
            rate_limit_window_seconds=WINDOW,
            lease_window_seconds=WINDOW,
        )
        return result.ctx.lease_id if result.ctx is not None else None


@pytest.mark.usefixtures("dsn", "db")
def test_eight_requests_race_for_last_credit_exactly_one_wins(dsn: str, db: Any) -> None:
    acct = seed_account(db, free_tier_limit=3, free_tier_count=2)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [
            pool.submit(_admit_thread, dsn, acct["tenant_id"], acct["account_id"], i)
            for i in range(8)
        ]
    winners = [f.result() for f in futures]
    admitted = [w for w in winners if w is not None]

    assert len(admitted) == 1, (
        "exactly one request may win the last free credit, "
        f"got {len(admitted)} admitted"
    )

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s",
            (acct["account_id"],),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["free_tier_count"] == 3, "counter must read 3, never 4"

    # The lone winner holds the only live generation lease; no other request
    # may have created book/conversation/version stubs (they all lost).
    with db.cursor() as cur:
        cur.execute(
            "SELECT count(*) AS n FROM run_states "
            "WHERE tenant_id = %s AND account_id = %s AND kind = 'generation'",
            (acct["tenant_id"], acct["account_id"]),
        )
        leases = cur.fetchone()
    assert leases is not None
    assert leases["n"] == 1, "exactly one live generation lease must exist"
"""T015/T016 — device/IP rate-limit race (FR-002).

Written FIRST (TDD): fails until gate.bump_rate_limit exists. Fires N
concurrent bumps from one device key / one IP key at exactly the configured
threshold and asserts:
  - exactly `threshold` requests are admitted (never more),
  - over-limit requests are rejected (False),
  - one `rate_limit_counts` row per (kind, scope_key, window) remains.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
import pytest
from conftest import seed_account
from psycopg import Connection
from psycopg.rows import dict_row

from orchestrator import gate

THRESHOLD = 2
WINDOW = 60


def _bump_thread(
    dsn: str, *, tenant_id: str, account_id: str, kind: str, scope_key: str
) -> bool:
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    with conn:
        return gate.bump_rate_limit(
            conn,
            tenant_id=tenant_id,
            account_id=account_id,
            kind=kind,
            scope_key=scope_key,
            window_seconds=WINDOW,
            threshold=THRESHOLD,
        )


@pytest.mark.usefixtures("dsn", "db")
def test_concurrent_device_burst_never_overshoots(dsn: str, db: Any) -> None:
    acct = seed_account(db)
    scope_key = "device-" + acct["account_id"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [
            pool.submit(
                _bump_thread,
                dsn,
                tenant_id=acct["tenant_id"],
                account_id=acct["account_id"],
                kind="device",
                scope_key=scope_key,
            )
            for _ in range(8)
        ]
    admitted = sum(1 for r in results if r.result())

    assert admitted == THRESHOLD, (
        f"exactly {THRESHOLD} requests may pass the threshold, got {admitted}"
    )


@pytest.mark.usefixtures("dsn", "db")
def test_concurrent_ip_burst_never_overshoots(dsn: str, db: Any) -> None:
    acct = seed_account(db)
    scope_key = "ip-" + acct["account_id"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [
            pool.submit(
                _bump_thread,
                dsn,
                tenant_id=acct["tenant_id"],
                account_id=acct["account_id"],
                kind="ip",
                scope_key=scope_key,
            )
            for _ in range(8)
        ]
    admitted = sum(1 for r in results if r.result())

    assert admitted == THRESHOLD, (
        f"exactly {THRESHOLD} requests may pass the threshold, got {admitted}"
    )


@pytest.mark.usefixtures("dsn", "db")
def test_over_limit_leaves_single_window_row(db: Connection[Any], fresh_account: dict[str, str]) -> None:
    acct = fresh_account
    for _ in range(THRESHOLD + 3):
        gate.bump_rate_limit(
            db,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
            kind="device",
            scope_key="shared-key",
            window_seconds=WINDOW,
            threshold=THRESHOLD,
        )

    with db.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) AS n, max(count) AS c
            FROM rate_limit_counts
            WHERE tenant_id = %s AND account_id = %s AND kind = 'device'
              AND scope_key = 'shared-key'
            """,
            (acct["tenant_id"], acct["account_id"]),
        )
        row = cur.fetchone()

    assert row is not None
    assert row["n"] == 1, "one row per (tenant, account, kind, scope_key, window)"
    assert row["c"] == THRESHOLD, "count must stop at the threshold, never exceed it"
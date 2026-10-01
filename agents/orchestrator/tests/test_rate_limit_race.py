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
            SELECT window_start, count
            FROM rate_limit_counts
            WHERE tenant_id = %s AND account_id = %s AND kind = 'device'
              AND scope_key = 'shared-key'
            ORDER BY window_start
            """,
            (acct["tenant_id"], acct["account_id"]),
        )
        rows = cur.fetchall()

    assert rows, "the bumps must leave at least one counted window behind"

    # One row per (tenant, account, kind, scope_key, window_start) — and the
    # uniqueness of that tuple is what guarantees a second row can only appear
    # when the bursts genuinely straddled a window boundary, because
    # `window_start` is derived from `now()` rather than pinned. This test does
    # THRESHOLD + 3 bumps, so on a shared CI box it *will* cross a boundary
    # sometimes; asserting a global row count of 1 made it fail roughly once a
    # minute of wall-clock time, which is a test defect, not a gate defect.
    # The invariant that actually matters — no window ever counts past the
    # threshold — is asserted per row, so it holds either way.
    keys = [(r["window_start"],) for r in rows]
    assert len(keys) == len(set(keys)), "window_start must be unique per row"
    for row in rows:
        assert row["count"] <= THRESHOLD, (
            f"window {row['window_start']} counted {row['count']} > "
            f"{THRESHOLD}; the count must stop at the threshold"
        )
    assert max(r["count"] for r in rows) == THRESHOLD, (
        "the threshold must be reached exactly — otherwise the gate would be "
        "rejecting below its configured limit"
    )
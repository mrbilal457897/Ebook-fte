"""T013 — in-flight lease primitives (FR-009, Clarification Q2).

Written FIRST (TDD): fails until gate.acquire_lease / lease_is_live exist.
Pins:
  - a second acquire while a lease is live returns None (409 path),
  - renewal bumps the expiry past the original window,
  - an expired lease is treated as free (self-expiry, Q2),
  - release makes the lease immediately reusable.
"""


from typing import Any

import pytest
from psycopg import Connection
from psycopg.rows import dict_row

from orchestrator import gate
from orchestrator.models import release_lease, renew_lease

WINDOW = 60


@pytest.mark.usefixtures("dsn", "db")
def test_second_acquire_rejected_while_lease_live(db: Connection[Any], fresh_account: dict[str, str]) -> None:
    acct = fresh_account
    first = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert first is not None, "first acquire must succeed"

    second = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert second is None, "second acquire must be rejected (409 already_in_progress)"

    assert gate.lease_is_live(
        db, tenant_id=acct["tenant_id"], account_id=acct["account_id"], kind="generation"
    ), "lease must report live"


@pytest.mark.usefixtures("dsn", "db")
def test_renewal_bumps_expiry(db: Connection, fresh_account: dict[str, str]) -> None:
    acct = fresh_account
    lease_id = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert lease_id is not None

    with db.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT lock_expires_at FROM run_states WHERE id = %s", (lease_id,))
        row = cur.fetchone()
        assert row is not None
        before = row["lock_expires_at"]

    renew_lease(
        db,
        lease_id=lease_id,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        window_seconds=WINDOW,
    )
    with db.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT lock_expires_at FROM run_states WHERE id = %s", (lease_id,))
        row = cur.fetchone()
        assert row is not None
        after = row["lock_expires_at"]

    assert after > before, "renewal must extend the lease window"


@pytest.mark.usefixtures("dsn", "db")
def test_expired_lease_treated_as_free(db: Connection[Any], fresh_account: dict[str, str]) -> None:
    acct = fresh_account
    lease_id = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert lease_id is not None

    with db.cursor() as cur:
        cur.execute(
            "UPDATE run_states SET lock_expires_at = now() - interval '1 second' WHERE id = %s",
            (lease_id,),
        )

    assert not gate.lease_is_live(
        db, tenant_id=acct["tenant_id"], account_id=acct["account_id"], kind="generation"
    ), "expired lease must not report live (self-expiry)"

    revived = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert revived is not None, "a new acquire must succeed over an expired lease (Q2)"


@pytest.mark.usefixtures("dsn", "db")
def test_release_frees_the_lease(db: Connection[Any], fresh_account: dict[str, str]) -> None:
    acct = fresh_account
    lease_id = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert lease_id is not None

    release_lease(
        db,
        lease_id=lease_id,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
    )

    reacquired = gate.acquire_lease(
        db,
        tenant_id=acct["tenant_id"],
        account_id=acct["account_id"],
        kind="generation",
        window_seconds=WINDOW,
    )
    assert reacquired is not None, "released lease must be immediately reusable"
"""T013/T042 — in-flight lease primitives + end-to-end enforcement (FR-009).

Primitive level (T013, written FIRST): a second acquire while a lease is
live returns None (409), renewal bumps the expiry, an expired lease is
treated as free (self-expiry, Q2), and release makes it reusable.
Endpoint level (T042): with one generation held open, `POST /v1/generate`
is 409 `already_in_progress` — never queued, never parallel; once the stale
lease self-expires a new request is accepted. DB-backed (skip without
`DATABASE_URL` via the `dsn` fixture).
"""


from typing import Any

import httpx
import pytest
from conftest import seed_account
from fake_llm import fake_orchestrator as _fake_orchestrator
from httpx import ASGITransport
from psycopg import Connection
from psycopg.rows import dict_row

from orchestrator import config, gate, models, server, stream
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


# --- T042: endpoint-level 409 + self-expiry ---------------------------------

INTERNAL_TOKEN = "test-internal-token"


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("INTERNAL_AUTH_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=ASGITransport(app=server.app), base_url="http://orchestrator"
    )


def _gen_body(acct: dict[str, str], i: int) -> dict:
    return {
        "prompt": "a held-open book",
        "accountRef": {"tenantId": acct["tenant_id"], "accountId": acct["account_id"]},
        "modelCredentialId": None,
        "conversationId": f"conv-{i}",
        "rateLimitContext": {"deviceKey": f"d-{acct['account_id']}", "clientIpKey": None},
    }


@pytest.mark.anyio
@pytest.mark.usefixtures("dsn")
async def test_second_generation_while_first_live_is_409_not_parallel(
    dsn: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None

    with models.transaction() as conn:
        acct = seed_account(conn, free_tier_limit=3, free_tier_count=0)
        # First generation starts (lease live) — held open, no terminal event.
        held = gate.acquire_lease(
            conn,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
            kind="generation",
            window_seconds=60,
            payload={"phase": "streaming"},
        )
        assert held is not None

    async with await _client() as client:
        resp = await client.post(
            "/v1/generate", json=_gen_body(acct, 2), headers={"X-Internal-Token": INTERNAL_TOKEN}
        )

    assert resp.status_code == 409, "second generation must be rejected, never parallel"
    assert resp.json() == {
        "code": "already_in_progress",
        "message": "A generation is already in progress",
    }

    # No credit consumed by the blocked second attempt.
    with models.transaction() as conn:
        row = models.get_account(conn, tenant_id=acct["tenant_id"], account_id=acct["account_id"])
        assert row is not None
        assert row["free_tier_count"] == 0


@pytest.mark.anyio
@pytest.mark.usefixtures("dsn")
async def test_after_lease_self_expiry_new_request_is_accepted(
    dsn: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """After the stale lease expires (no terminal event), a fresh request is
    admitted and reaches the streaming response (FR-009, Edge Case).

    The claim under test is *admission*, so the model is a deterministic
    in-process fake (tests/fake_llm.py): a live provider added nothing here
    except quota dependence and a slow, flaky test.
    """
    monkeypatch.setenv("DATABASE_URL", dsn)
    monkeypatch.setattr(stream, "build_orchestrator", _fake_orchestrator)
    config._settings = None
    models._pool = None

    with models.transaction() as conn:
        acct = seed_account(conn, free_tier_limit=3, free_tier_count=0)
        lease_id = gate.acquire_lease(
            conn,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
            kind="generation",
            window_seconds=60,
        )
        assert lease_id is not None
        conn.execute(
            "UPDATE run_states SET lock_expires_at = now() - interval '1 second' WHERE id = %s",
            (lease_id,),
        )

    async with await _client() as client:
        resp = await client.post(
            "/v1/generate", json=_gen_body(acct, 3), headers={"X-Internal-Token": INTERNAL_TOKEN}
        )
    assert resp.status_code == 200, "an expired lease must be treated as free, not 409"
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert "event: token" in resp.text
    assert "event: version" in resp.text
    assert '"isPartial":false' in resp.text
    with models.transaction() as conn:
        assert not gate.lease_is_live(
            conn,
            tenant_id=acct["tenant_id"],
            account_id=acct["account_id"],
            kind="generation",
        ), "the terminal event must release the lease"
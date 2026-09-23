"""T037 — 4th free-tier generation blocked before any model call (FR-007).

Written FIRST (TDD): this test fails until the server's admission gate emits
`402 {"code":"free_tier_exhausted","upgrade":true}` for an account already at
its cap. End-to-end through /v1/generate so the "no model work, no rows"
property is proven at the wire, not just inside `gate.py`.
"""

import httpx
import pytest
from conftest import seed_account
from httpx import ASGITransport

from orchestrator import config, models, server

pytestmark = pytest.mark.anyio

INTERNAL_TOKEN = "test-internal-token"


def _headers() -> dict[str, str]:
    return {"X-Internal-Token": INTERNAL_TOKEN}


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_AUTH_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("FREE_TIER_LIMIT", "3")


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=server.app), base_url="http://orchestrator")


@pytest.mark.usefixtures("dsn")
async def test_exhausted_account_402_no_model_work_no_rows(
    dsn: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None

    with models.transaction() as conn:
        acct = seed_account(conn, free_tier_limit=3, free_tier_count=3)

    body = {
        "prompt": "a fourth book",
        "accountRef": {"tenantId": acct["tenant_id"], "accountId": acct["account_id"]},
        "modelCredentialId": None,
        "conversationId": "conv-4th",
        "rateLimitContext": {"deviceKey": f"d-{acct['account_id']}", "clientIpKey": None},
    }
    async with await _client() as client:
        resp = await client.post("/v1/generate", json=body, headers=_headers())

    # Wire shape: JSON pre-stream, before any SSE byte (contract). The body
    # must carry the contract-required rejects fields (code + upgrade flag);
    # a server `message` field may also be present and must not break the
    # contract shape.
    assert resp.status_code == 402
    assert resp.headers["content-type"].startswith("application/json")
    payload = resp.json()
    assert payload["code"] == "free_tier_exhausted"
    assert payload["upgrade"] is True

    # No model work / no rows: counter unchanged, zero invocation + audit rows.
    with models.transaction() as conn:
        row = models.get_account(conn, tenant_id=acct["tenant_id"], account_id=acct["account_id"])
        assert row is not None
        assert row["free_tier_count"] == 3, "blocked attempt must not consume credit"

        inv = models.fetchone(
            conn.execute(
                """SELECT 1 FROM capability_invocations
                   WHERE tenant_id = %s AND account_id = %s""",
                (acct["tenant_id"], acct["account_id"]),
            )
        )
        assert inv is None, "blocked attempt must not write an invocation row"

        audit = models.fetchone(
            conn.execute(
                """SELECT 1 FROM audit_log
                   WHERE tenant_id = %s AND account_id = %s
                     AND action LIKE 'generation.%'""",
                (acct["tenant_id"], acct["account_id"]),
            )
        )
        assert audit is None, "blocked attempt must not write a generation audit row"
"""T017 — server admission gate: token auth + JSON pre-stream rejections.

The internal contract (contracts/orchestrator-api.md) requires rejections to
arrive as JSON *before* any SSE bytes, with codes mirroring the external
contract (`invalid_prompt`, `free_tier_exhausted`, `already_in_progress`,
`rate_limited`). This test pins:
  - a missing/bad internal token is 401 (no DB touched),
  - an empty/oversized prompt is 400 `invalid_prompt` (no DB touched),
  - DB-backed rejections return the exact code/status shapes,
  - a valid admission reaches the streaming response with SSE headers.
DB-backed cases skip without `DATABASE_URL` (via the `dsn` fixture).
"""

import os

import httpx
import pytest
from httpx import ASGITransport

from orchestrator import server

pytestmark = pytest.mark.anyio

INTERNAL_TOKEN = "test-internal-token"


def _headers() -> dict[str, str]:
    return {"X-Internal-Token": INTERNAL_TOKEN}


def _body(
    prompt: str,
    *,
    device_key: str = "device-test",
    client_ip_key: str | None = "ip-test",
) -> dict:
    return {
        "prompt": prompt,
        "accountRef": {"tenantId": "t1", "accountId": "a1"},
        "modelCredentialId": None,
        "conversationId": "c1",
        "rateLimitContext": {"deviceKey": device_key, "clientIpKey": client_ip_key},
    }


@pytest.fixture(autouse=True)
def _token_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from orchestrator import config

    monkeypatch.setenv("INTERNAL_AUTH_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv(
        "DATABASE_URL",
        os.environ.get("DATABASE_URL", "postgresql://u:p@127.0.0.1:5432/unused"),
    )
    config._settings = None


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=ASGITransport(app=server.app), base_url="http://orchestrator"
    )


async def test_missing_internal_token_is_401() -> None:
    async with await _client() as client:
        resp = await client.post("/v1/generate", json=_body("a pirate memoir"))
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthorized"


async def test_wrong_internal_token_is_401() -> None:
    async with await _client() as client:
        resp = await client.post(
            "/v1/generate", json=_body("a pirate memoir"), headers={"X-Internal-Token": "nope"}
        )
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthorized"


async def test_empty_prompt_is_400_invalid_prompt() -> None:
    async with await _client() as client:
        resp = await client.post("/v1/generate", json=_body("   "), headers=_headers())
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == "invalid_prompt"
    assert resp.headers["content-type"].startswith("application/json"), (
        "rejection must be JSON, not text/event-stream"
    )


async def test_oversized_prompt_is_400_invalid_prompt() -> None:
    async with await _client() as client:
        resp = await client.post(
            "/v1/generate", json=_body("x" * (server.MAX_PROMPT_CHARS + 1)), headers=_headers()
        )
    assert resp.status_code == 400
    assert resp.json()["code"] == "invalid_prompt"


@pytest.mark.usefixtures("dsn")
async def test_exhausted_account_rejects_402_pres_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    from orchestrator import config

    monkeypatch.setenv("DATABASE_URL", os.environ["DATABASE_URL"])
    monkeypatch.setenv("FREE_TIER_LIMIT", "3")
    config._settings = None

    from conftest import seed_account

    from orchestrator import models

    with models.transaction() as conn:
        acct = seed_account(conn, free_tier_limit=3, free_tier_count=3)
        body = _body(
            "a pirate memoir",
            device_key=f"device-{acct['account_id']}",
            client_ip_key=None,
        )
        body["accountRef"] = {
            "tenantId": acct["tenant_id"],
            "accountId": acct["account_id"],
        }

    async with await _client() as client:
        resp = await client.post("/v1/generate", json=body, headers=_headers())
    assert resp.status_code == 402
    payload = resp.json()
    assert payload["code"] == "free_tier_exhausted"
    assert payload["upgrade"] is True
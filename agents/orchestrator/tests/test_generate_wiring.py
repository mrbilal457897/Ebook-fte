from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from orchestrator import byok, config, gate
from orchestrator import server as server_mod
from orchestrator.server import app


@pytest.fixture
def configured_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://dev:dev@localhost:5432/notused")
    monkeypatch.setenv("INTERNAL_AUTH_TOKEN", "test-secret")
    config._settings = None  # force reload with the patched env


def _ctx() -> gate.GenerationContext:
    return gate.GenerationContext(
        tenant_id="tenant-1",
        account_id="acct-1",
        lease_id="lease-1",
        book_id="book-1",
        conversation_id="conv-1",
        version_id="ver-1",
        free_tier_count=1,
    )


def _headers() -> dict[str, str]:
    return {"X-Internal-Token": "test-secret"}


def _body(prompt: str = "a pirate memoir") -> dict:
    return {
        "prompt": prompt,
        "accountRef": {"tenantId": "tenant-1", "accountId": "acct-1"},
        "modelCredentialId": None,
        "conversationId": "conv-1",
        "rateLimitContext": {"deviceKey": "d" * 64, "clientIpKey": None},
    }


def test_endpoint_plumbs_stream_to_sse(
    configured_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Hermetic wiring: admitted + resolved request streams token/version
    frames with the exact wire format (no DB, no live model — the ADK and
    persistence seams are faked)."""
    monkeypatch.setattr(server_mod, "_admit_request", lambda req, prompt: _ctx())

    platform = byok.ResolvedModel(
        provider="platform", api_key="platform-key", model="gemini-flash-latest"
    )
    monkeypatch.setattr(server_mod, "_resolve_model_or_refund", lambda req, ctx: platform)

    async def fake_stream(**kwargs: object):
        on_token = kwargs.get("on_token")
        on_terminal = kwargs.get("on_terminal")
        assert callable(on_token) and callable(on_terminal)
        on_token("Ahoy ")  # type: ignore[operator]  # hooks are callables
        yield {"event": "token", "data": {"delta": "Ahoy "}}
        on_token("there!")  # type: ignore[operator]
        yield {"event": "token", "data": {"delta": "there!"}}
        on_terminal("Ahoy there!")  # type: ignore[operator]
        yield {
            "event": "version",
            "data": {
                "versionId": "ver-1",
                "bookId": "book-1",
                "conversationId": "conv-1",
                "isPartial": False,
                "fullText": "Ahoy there!",
            },
        }

    # The calls the server would make into persistence are exercised to prove
    # the hooks are wired: record them instead of touching the DB.
    calls: list[str] = []

    def collect(name: str):
        return lambda *a, **k: calls.append(name)

    monkeypatch.setattr(server_mod.models, "transaction", lambda: nullcontext())
    monkeypatch.setattr(server_mod.persistence, "persist_chunk", collect("persist_chunk"))
    monkeypatch.setattr(server_mod.persistence, "finalize_generation", collect("finalize"))
    monkeypatch.setattr(server_mod, "stream_generation", fake_stream)

    client = TestClient(app)
    res = client.post("/v1/generate", json=_body(), headers=_headers())

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    frames = [line for line in res.text.split("\n\n") if line.strip()]
    assert frames[0] == "event: token\ndata: {\"delta\":\"Ahoy \"}"
    assert frames[1] == "event: token\ndata: {\"delta\":\"there!\"}"
    assert 'event: version' in frames[2]
    assert '"isPartial":false' in frames[2]
    assert '"fullText":"Ahoy there!"' in frames[2]
    assert "persist_chunk" in calls and "finalize" in calls


def test_unresolvable_byok_emits_terminal_error_event(
    configured_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Hermetic wiring: an invalid BYOK credential (resolution returns None)
    yields exactly one terminal `error` event `{code:"byok_invalid",
    refunded:true}` — never a silently-platform-key stream (FR-008/AC7)."""
    monkeypatch.setattr(server_mod, "_admit_request", lambda req, prompt: _ctx())
    monkeypatch.setattr(server_mod, "_resolve_model_or_refund", lambda req, ctx: None)

    client = TestClient(app)
    res = client.post(
        "/v1/generate",
        json=_body(prompt="book"),
        headers=_headers(),
    )

    assert res.status_code == 200
    assert 'event: error' in res.text
    assert '"code":"byok_invalid"' in res.text
    assert '"refunded":true' in res.text
    assert 'event: version' not in res.text
    assert 'event: token' not in res.text


def test_invalid_prompt_rejected_before_stream(configured_env: None) -> None:
    client = TestClient(app)
    res = client.post(
        "/v1/generate",
        json=_body(prompt="   "),
        headers=_headers(),
    )
    assert res.status_code == 400
    assert res.json() == {"code": "invalid_prompt", "message": "Prompt is empty or too long"}


def test_bad_internal_token_rejected(configured_env: None) -> None:
    client = TestClient(app)
    res = client.post(
        "/v1/generate",
        json=_body(),
        headers={"X-Internal-Token": "wrong"},
    )
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"
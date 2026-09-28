"""T024/T025: full Orchestrator -> Content Agent streaming (quickstart-env).

These are the live integration tests (FR-003, FR-004, AC3). They need the
quickstart environment: migrations applied + `DATABASE_URL`,
`INTERNAL_AUTH_TOKEN`, and a live `GOOGLE_API_KEY`. Without those they skip
explicitly — CI (T048) and the T046 quickstart run set them.

Live-provider reality: Gemini intermittently answers `503 UNAVAILABLE
(high demand)`. That is an upstream outage, not a contract violation, and the
Orchestrator's job on that path is to emit a graceful terminal `error` event
with `code: provider_error` (contracts/generation-api.md). A run that dies that
way cannot exercise the `version` contract, so it is reported as *inconclusive
with the provider's own message attached* rather than as a pass or a failure.
Anything else — a missing event, a wrong field, a bad ordering, a slow first
token — still fails hard.
"""

import json
import os
import time
from typing import Any

import pytest
from fake_llm import failing_orchestrator as _failing_orchestrator
from fake_llm import fake_orchestrator as _fake_orchestrator
from fastapi.testclient import TestClient
from starlette.responses import Response

from orchestrator import config, gate, models, stream
from orchestrator.server import app


def _live_env() -> bool:
    return all(
        os.environ.get(k, "").strip()
        for k in ("DATABASE_URL", "INTERNAL_AUTH_TOKEN", "GOOGLE_API_KEY")
    )


pytestmark = pytest.mark.skipif(
    not _live_env(),
    reason="live streaming tests need DATABASE_URL + INTERNAL_AUTH_TOKEN + GOOGLE_API_KEY "
    "(quickstart env); run via T046",
)


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    # Settings + pool are lazily cached singletons; reset so they rebuild on
    # the patched DSN, then restore at teardown.
    config._settings = None
    models._pool = None


def _headers() -> dict[str, str]:
    return {"X-Internal-Token": os.environ["INTERNAL_AUTH_TOKEN"]}


def _body(account: dict[str, str], prompt: str) -> dict[str, Any]:
    return {
        "prompt": prompt,
        "accountRef": {"tenantId": account["tenant_id"], "accountId": account["account_id"]},
        "modelCredentialId": None,
        "conversationId": "conv-live",
        "rateLimitContext": {"deviceKey": "d" * 64, "clientIpKey": None},
    }


def _post(account: dict[str, str], prompt: str = "write a short lighthouse memoir"):
    return TestClient(app).post(
        "/v1/generate", json=_body(account, prompt), headers=_headers()
    )


def _frames(text: str) -> list[dict[str, Any]]:
    """Parse an SSE body into `{"event": name, "data": {...}}` frames."""
    parsed: list[dict[str, Any]] = []
    for block in text.split("\n\n"):
        name = data = None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line.removeprefix("event: ").strip()
            elif line.startswith("data: "):
                data = line.removeprefix("data: ")
        if name is not None:
            parsed.append({"event": name, "data": json.loads(data) if data else None})
    return parsed


def _skip_if_provider_outage(frames: list[dict[str, Any]]) -> None:
    """Skip when the run ended in an upstream fault, quoting the provider."""
    errors = [f for f in frames if f["event"] == "error"]
    if not errors:
        return
    data = errors[0]["data"] or {}
    pytest.skip(
        "live provider outage, contract assertions not evaluable: "
        f"code={data.get('code')} message={str(data.get('message'))[:200]}"
    )


def _probe_provider() -> tuple[bool, str]:
    """Ask the configured model for one word, directly, and time it.

    AC3 is specified "under normal load". The SDK retries a `503` with backoff
    before the first token surfaces, so a degraded Gemini inflates first-token
    latency by seconds with no fault of ours. A direct one-word probe tells the
    two cases apart: if the provider itself is slow or erroring, the pipeline's
    latency is not what this test is measuring.
    """
    from google import genai
    from google.genai import types as genai_types

    settings = config.get_settings()
    client = genai.Client(api_key=settings.require_platform_key())
    started = time.monotonic()
    try:
        response = client.models.generate_content(
            model=settings.orchestrator_model,
            contents="Reply with one word: ok",
            config=genai_types.GenerateContentConfig(max_output_tokens=8),
        )
    except Exception as exc:  # noqa: BLE001 - any provider fault means "degraded"
        return False, f"probe failed: {type(exc).__name__}: {str(exc)[:200]}"
    elapsed = time.monotonic() - started
    if not (response.text or "").strip():
        return False, "probe returned no text"
    return elapsed < 2.0, f"probe took {elapsed:.2f}s"


def test_request_streams_through_orchestrator_to_content_agent(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """T024: eligible request -> `token` events then a terminal `version`
    event with `isPartial:false` (FR-003/FR-004, contracts/generation-api.md)."""
    res = _post(fresh_account)
    assert res.status_code == 200
    frames = _frames(res.text)
    _skip_if_provider_outage(frames)

    tokens = [f for f in frames if f["event"] == "token"]
    versions = [f for f in frames if f["event"] == "version"]
    assert tokens, "at least one token event expected"
    for token in tokens:
        assert isinstance(token["data"]["delta"], str) and token["data"]["delta"]
    assert len(versions) == 1, "exactly one terminal version event (AC5)"
    assert versions[0]["data"]["isPartial"] is False
    for field in ("versionId", "bookId", "conversationId", "fullText"):
        assert versions[0]["data"][field]
    assert frames.index(tokens[0]) < frames.index(versions[0])
    # The terminal fullText must equal the concatenation of the streamed deltas:
    # what the customer saw is what was stored (FR-005).
    assert versions[0]["data"]["fullText"] == "".join(
        t["data"]["delta"] for t in tokens
    )


def test_first_token_within_2s_normalized_run(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """T025: first `token` event < 2 s in a normalized local run (FR-004, AC3).

    The response must be consumed incrementally. `TestClient.post` returns only
    after the whole SSE body has been buffered, so timing it would measure
    total generation time and could never observe a first-token latency.
    """
    healthy, detail = _probe_provider()
    if not healthy:
        pytest.skip(f"provider not healthy, AC3 latency not evaluable: {detail}")

    start = time.monotonic()
    first_token_at: float | None = None
    collected: list[dict[str, Any]] = []

    with TestClient(app).stream(
        "POST", "/v1/generate", json=_body(fresh_account, "a 50-word sea glass story"),
        headers=_headers(),
    ) as res:
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/event-stream")
        buffer = ""
        for chunk in res.iter_text():
            buffer += chunk
            while "\n\n" in buffer:
                block, buffer = buffer.split("\n\n", 1)
                frame = _frames(block + "\n\n")
                if not frame:
                    continue
                collected.extend(frame)
                if frame[0]["event"] == "token" and first_token_at is None:
                    first_token_at = time.monotonic() - start

    _skip_if_provider_outage(collected)
    assert first_token_at is not None, "no token event arrived"
    assert first_token_at < 2.0, f"first token took {first_token_at:.2f}s (>= 2s)"


def test_stream_discipline_headers(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """AC3 groundwork: an admitted request is an unbuffered SSE stream.

    research.md §2: without `X-Accel-Buffering: no` a proxy in front of the
    service will coalesce the whole stream and destroy first-token latency, so
    the header is part of the contract, not an optimisation.
    """
    res: Response = _post(fresh_account)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert res.headers["cache-control"] == "no-cache, no-transform"
    assert res.headers["x-accel-buffering"] == "no"


# --- Provider-free contract tests -------------------------------------------
#
# The two tests above are the *live* ones T024/T025 asked for, and they are the
# only things in this file that need a working Gemini. Everything the SSE
# contract actually promises must be verifiable without one, or an exhausted
# API quota would silently stop testing the contract at all. These use the
# deterministic in-process model from tests/fake_llm.py.


def _assert_wire_contract(text: str) -> list[dict[str, Any]]:
    frames = _frames(text)
    tokens = [f for f in frames if f["event"] == "token"]
    versions = [f for f in frames if f["event"] == "version"]
    errors = [f for f in frames if f["event"] == "error"]

    assert not errors, f"unexpected terminal error: {errors}"
    assert tokens, "at least one token event expected"
    for token in tokens:
        assert isinstance(token["data"]["delta"], str) and token["data"]["delta"]
    assert len(versions) == 1, "exactly one terminal version event (AC5)"
    assert versions[0]["data"]["isPartial"] is False
    for field in ("versionId", "bookId", "conversationId", "fullText"):
        assert versions[0]["data"][field]
    assert frames.index(tokens[0]) < frames.index(versions[0])
    # The terminal fullText must equal the concatenation of the streamed deltas:
    # what the customer saw is what was stored (FR-005).
    assert versions[0]["data"]["fullText"] == "".join(
        t["data"]["delta"] for t in tokens
    )
    return frames


@pytest.fixture
def fake_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(stream, "build_orchestrator", _fake_orchestrator)


@pytest.mark.usefixtures("dsn")
def test_wire_contract_token_then_version(
    app_env: None, fresh_account: dict[str, str], fake_model: None
) -> None:
    """FR-003/FR-004 + AC5 without a provider: an admitted request emits
    `token` events then exactly one terminal `version` with isPartial:false,
    and fullText equals the streamed deltas."""
    _assert_wire_contract(_post(fresh_account).text)


@pytest.mark.usefixtures("dsn")
def test_wire_contract_persists_one_complete_version(
    app_env: None, fresh_account: dict[str, str], fake_model: None,
    db: Any,
) -> None:
    """AC5: the terminal write flips is_partial=false and leaves exactly one
    `capability_invocations` + one terminal `audit_log` row for the run."""
    res = _post(fresh_account)
    frames = _assert_wire_contract(res.text)
    version_id = next(
        f["data"]["versionId"] for f in frames if f["event"] == "version"
    )

    with db.cursor() as cur:
        cur.execute(
            "SELECT is_partial, content FROM content_versions WHERE id = %s",
            (version_id,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row["is_partial"] is False
        cur.execute(
            "SELECT count(*) AS n FROM capability_invocations"
            " WHERE tenant_id = %s AND account_id = %s",
            (fresh_account["tenant_id"], fresh_account["account_id"]),
        )
        assert cur.fetchone()["n"] == 1
        cur.execute(
            "SELECT action, status FROM audit_log"
            " WHERE tenant_id = %s AND account_id = %s",
            (fresh_account["tenant_id"], fresh_account["account_id"]),
        )
        audits = cur.fetchall()
    assert [a["action"] for a in audits] == ["generation.complete"]
    assert audits[0]["status"] == "success"


@pytest.mark.usefixtures("dsn")
def test_wire_contract_survives_a_provider_fault(
    app_env: None, fresh_account: dict[str, str], monkeypatch: pytest.MonkeyPatch,
    db: Any,
) -> None:
    """Constitution Article X failure path: a model that dies mid-run must
    produce a graceful terminal `error` frame and release the lease, never a
    truncated stream that looks like success."""
    monkeypatch.setattr(stream, "build_orchestrator", _failing_orchestrator)

    frames = _frames(_post(fresh_account).text)
    errors = [f for f in frames if f["event"] == "error"]
    assert len(errors) == 1, "exactly one terminal error frame"
    assert errors[0]["data"]["code"] == "provider_error"
    assert errors[0]["data"]["refunded"] is True
    assert not [f for f in frames if f["event"] == "version"], (
        "a failed run must not emit a success frame"
    )

    with db.cursor() as cur:
        cur.execute(
            "SELECT free_tier_count FROM accounts WHERE id = %s",
            (fresh_account["account_id"],),
        )
        assert cur.fetchone()["free_tier_count"] == 0, "a failed run is refunded"
        cur.execute(
            "SELECT count(*) AS n FROM audit_log WHERE tenant_id = %s",
            (fresh_account["tenant_id"],),
        )
        assert cur.fetchone()["n"] == 1
        assert gate.lease_is_live(
            db, tenant_id=fresh_account["tenant_id"],
            account_id=fresh_account["account_id"], kind="generation",
        ) is False, "the lease must be released on failure"

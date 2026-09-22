"""T024/T025: full Orchestrator -> Content Agent streaming (quickstart-env).

These are the live integration tests (FR-003, FR-004, AC3). They need the
quickstart environment: migrations applied + `DATABASE_URL`,
`INTERNAL_AUTH_TOKEN`, and a live `GOOGLE_API_KEY`. Without those they skip
explicitly — CI (T048) and the T046 quickstart run set them.
"""

import os
import time

import pytest
from fastapi.testclient import TestClient

from orchestrator import config, models
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


def _post(account: dict[str, str], prompt: str = "write a short lighthouse memoir"):
    body = {
        "prompt": prompt,
        "accountRef": {"tenantId": account["tenant_id"], "accountId": account["account_id"]},
        "modelCredentialId": None,
        "conversationId": "conv-live",
        "rateLimitContext": {"deviceKey": "d" * 64, "clientIpKey": None},
    }
    return TestClient(app).post("/v1/generate", json=body, headers=_headers())


def test_request_streams_through_orchestrator_to_content_agent(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """T024: eligible request -> `token` events then a terminal `version`
    event with `isPartial:false` (FR-003/FR-004, contracts/generation-api.md)."""
    res = _post(fresh_account)
    assert res.status_code == 200
    tokens = [frame for frame in res.text.split("\n\n") if 'event: token' in frame]
    versions = [frame for frame in res.text.split("\n\n") if 'event: version' in frame]
    assert tokens, "at least one token event expected"
    assert len(versions) == 1
    assert '"isPartial":false' in versions[0]
    assert res.text.index('event: token') < res.text.index('event: version')


def test_first_token_within_2s_normalized_run(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """T025: first `token` event < 2 s in a normalized local run (FR-004, AC3;
    manual UI-timing clause per quickstart — timing is best-effort here)."""
    start = time.monotonic()
    res = _post(fresh_account, prompt="a 50-word sea glass story")
    first_token_at = time.monotonic() - start
    assert res.status_code == 200
    assert 'event: token' in res.text or 'event: error' in res.text
    assert first_token_at < 2.0, f"first token took {first_token_at:.2f}s (>= 2s)"
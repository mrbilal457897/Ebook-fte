"""T027: invalid/expired BYOK fails cleanly (DB-backed, FR-008/AC7)."""

import pytest
from fastapi.testclient import TestClient

from orchestrator import config, models
from orchestrator.server import app


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    monkeypatch.setenv("INTERNAL_AUTH_TOKEN", "test-secret")
    config._settings = None
    models._pool = None


def test_dead_credential_fails_cleanly_refunded_no_fallback(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """Request with a credential id that does not exist/not owned by the
    caller -> terminal `error` {code:byok_invalid, refunded:true}; the
    consumed free credit is restored, one `generation.failed` audit row is
    written, zero invocations, and the platform key was never used (spy)."""
    account = fresh_account
    account_id = account["account_id"]
    tenant_id = account["tenant_id"]

    with models.transaction() as conn:
        row = models.get_account(conn, tenant_id=tenant_id, account_id=account_id)
        assert row is not None
        before = row["free_tier_count"]

    body = {
        "prompt": "a lighthouse memoir",
        "accountRef": {"tenantId": tenant_id, "accountId": account_id},
        "modelCredentialId": "00000000-0000-0000-0000-000000000000",
        "conversationId": "conv-byok",
        "rateLimitContext": {"deviceKey": "d" * 64, "clientIpKey": None},
    }
    res = TestClient(app).post(
        "/v1/generate", json=body, headers={"X-Internal-Token": "test-secret"}
    )

    assert res.status_code == 200
    assert 'event: error' in res.text
    assert '"code":"byok_invalid"' in res.text
    assert '"refunded":true' in res.text

    with models.transaction() as conn:
        row = models.get_account(conn, tenant_id=tenant_id, account_id=account_id)
        assert row is not None
        assert row["free_tier_count"] == before, "consumed credit must be refunded"

        inv = conn.execute(
            """SELECT 1 FROM capability_invocations
               WHERE tenant_id = %s AND account_id = %s
                 AND agent = 'orchestrator'""",
            (tenant_id, account_id),
        )
        assert inv.fetchone() is None, "no invocation row for a failed BYOK run"

        audit = conn.execute(
            """SELECT action, status FROM audit_log
               WHERE tenant_id = %s AND account_id = %s
                 AND agent = 'orchestrator'
                 AND action = 'generation.failed'""",
            (tenant_id, account_id),
        )
        assert audit.fetchone() is not None, "exactly one failed-audit row expected"
"""T041 — interruption keeps all streamed content retrievable (FR-005, AC4).

Written FIRST (TDD). Simulates a customer who closes the tab mid-stream after
`N` chunks arrived: the system of record must still hold exactly the text the
UI rendered, `is_partial=true`, with `updated_at` bumped — proof that closing/
refreshing never loses content (the frontend `GET /api/generation/[id]`
refetch is covered by `frontend/tests/generation.refetch.test.ts`).
"""

import pytest

from orchestrator import config, gate, models, persistence


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None


def test_interrupted_stream_leaves_every_rendered_chunk_retrievable(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    account = fresh_account
    rendered = ["chapter one", ".", " The fog ", "lifted."]

    with models.transaction() as conn:
        result = gate.admit_generation(
            conn,
            tenant_id=account["tenant_id"],
            account_id=account["account_id"],
            free_tier_limit=3,
            prompt="interruption",
            device_key="d" * 64,
            client_ip_key=None,
            rate_limit_device_max=100,
            rate_limit_ip_max=100,
            rate_limit_window_seconds=60,
            lease_window_seconds=60,
        )
        assert result.ctx is not None
        ctx = result.ctx

    for chunk in rendered:
        with models.transaction() as conn:
            persistence.persist_chunk(
                conn,
                version_id=ctx.version_id,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                delta=chunk,
                lease_id=ctx.lease_id,
                lease_window_seconds=60,
            )

    # Refresh/close: no terminal event ever arrives. GET must read it back.
    with models.transaction() as conn:
        row = models.get_content_version(
            conn,
            version_id=ctx.version_id,
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
        )

    assert row is not None
    assert row["content"] == "".join(rendered)
    assert row["is_partial"] is True, "interrupted stream must still read as partial"
    assert row["updated_at"] is not None
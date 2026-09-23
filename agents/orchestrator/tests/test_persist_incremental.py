"""T026: streamed content is persisted incrementally (DB-backed, FR-005)."""

import pytest

from orchestrator import config, gate, models, persistence


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None


def test_content_never_diverges_from_ui_at_any_chunk_boundary(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """Chunk-by-chunk: after each `persist_chunk`, the DB row equals the
    accumulated text, `is_partial` stays true, then terminal finalize flips
    it false (FR-005, AC4)."""
    account = fresh_account
    with models.transaction() as conn:
        result = gate.admit_generation(
            conn,
            tenant_id=account["tenant_id"],
            account_id=account["account_id"],
            free_tier_limit=3,
            prompt="incremental test",
            device_key="d" * 64,
            client_ip_key=None,
            rate_limit_device_max=100,
            rate_limit_ip_max=100,
            rate_limit_window_seconds=60,
            lease_window_seconds=60,
        )
        assert result.ctx is not None
        ctx = result.ctx
        row = models.get_content_version(
            conn, version_id=ctx.version_id, tenant_id=ctx.tenant_id, account_id=ctx.account_id
        )
        assert row is not None
        assert row["is_partial"] is True
        assert row["content"] == ""

    ui_view = ""
    for chunk in ("The fog ", "rolled in ", "before dawn.", " It dampened ", "the lamp"):
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
        ui_view += chunk
        with models.transaction() as conn:
            row = models.get_content_version(
                conn,
                version_id=ctx.version_id,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
            )
            assert row is not None
            assert row["content"] == ui_view, "DB content diverged from UI at a chunk boundary"
            assert row["is_partial"] is True

    with models.transaction() as conn:
        persistence.finalize_generation(
            conn,
            version_id=ctx.version_id,
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
            lease_id=ctx.lease_id,
            agent="orchestrator",
            inputs={"prompt": "incremental test"},
            output={"fullText": ui_view},
            latency_ms=5,
            success=True,
        )

    with models.transaction() as conn:
        row = models.get_content_version(
            conn,
            version_id=ctx.version_id,
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
        )
        assert row is not None
        assert row["content"] == ui_view
        assert row["is_partial"] is False


def test_per_chunk_lease_renewal_extends_the_live_lease(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """T043 groundwork: persist_chunk renews the lease each chunk, so a long
    stream never drops into 'expired' midway (FR-009, Clarification Q2)."""
    account = fresh_account
    with models.transaction() as conn:
        result = gate.admit_generation(
            conn,
            tenant_id=account["tenant_id"],
            account_id=account["account_id"],
            free_tier_limit=3,
            prompt="lease renewal",
            device_key="d" * 64,
            client_ip_key=None,
            rate_limit_device_max=100,
            rate_limit_ip_max=100,
            rate_limit_window_seconds=60,
            lease_window_seconds=1,
        )
        assert result.ctx is not None
        ctx = result.ctx
        # Lease starts live.
        live_before = models.get_live_lease(
            conn, tenant_id=ctx.tenant_id, account_id=ctx.account_id, kind="generation"
        )
        assert live_before is not None
        expiry_before = live_before["lock_expires_at"]

    for chunk in ("a", "b", "c"):
        with models.transaction() as conn:
            persistence.persist_chunk(
                conn,
                version_id=ctx.version_id,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                delta=chunk,
                lease_id=ctx.lease_id,
                lease_window_seconds=30,
            )

    with models.transaction() as conn:
        live_after = models.get_live_lease(
            conn, tenant_id=ctx.tenant_id, account_id=ctx.account_id, kind="generation"
        )
    assert live_after is not None, "lease must stay live across chunk writes"
    assert live_after["lock_expires_at"] > expiry_before, (
        "per-chunk renewal must extend the lease window forward"
    )
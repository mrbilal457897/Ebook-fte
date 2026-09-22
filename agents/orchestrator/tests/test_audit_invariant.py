"""T028: exactly one invocation + one terminal audit row per generation
(DB-backed, FR-006/AC5)."""

import pytest

from orchestrator import config, gate, models, persistence


@pytest.fixture
def app_env(monkeypatch: pytest.MonkeyPatch, dsn: str) -> None:
    monkeypatch.setenv("DATABASE_URL", dsn)
    config._settings = None
    models._pool = None


def _run_one_complete_generation(account: dict[str, str], chunks: list[str]) -> None:
    with models.transaction() as conn:
        result = gate.admit_generation(
            conn,
            tenant_id=account["tenant_id"],
            account_id=account["account_id"],
            free_tier_limit=3,
            prompt="audit invariant",
            device_key="d" * 64,
            client_ip_key=None,
            rate_limit_device_max=100,
            rate_limit_ip_max=100,
            rate_limit_window_seconds=60,
            lease_window_seconds=60,
        )
        assert result.ctx is not None
        ctx = result.ctx

    for chunk in chunks:
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

    with models.transaction() as conn:
        persistence.finalize_generation(
            conn,
            version_id=ctx.version_id,
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
            lease_id=ctx.lease_id,
            agent="orchestrator",
            inputs={"prompt": "audit invariant"},
            output={"fullText": "".join(chunks)},
            latency_ms=7,
            success=True,
        )


def test_exactly_one_invocation_and_one_terminal_audit_row(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """One successful generation -> exactly 1 `capability_invocations` row and
    exactly 1 terminal `audit_log` row (`generation.complete`), both
    tenant-scoped, written in the same transaction as the final content write
    (FR-006, AC5). No spurious rows from chunk writes (T049)."""
    account = fresh_account
    _run_one_complete_generation(account, chunks=["One ", "two ", "three"])

    with models.transaction() as conn:
        inv_rows = models.fetchall(
            conn.execute(
                """SELECT action, success, agent FROM capability_invocations
                   WHERE tenant_id = %s AND account_id = %s
                     AND agent = 'orchestrator'""",
                (account["tenant_id"], account["account_id"]),
            )
        )
        assert len(inv_rows) == 1
        assert inv_rows[0]["action"] == "generation.complete"
        assert inv_rows[0]["success"] is True

        audit_rows = models.fetchall(
            conn.execute(
                """SELECT action, status FROM audit_log
                   WHERE tenant_id = %s AND account_id = %s
                     AND agent = 'orchestrator'
                     AND action IN ('generation.complete', 'generation.failed')""",
                (account["tenant_id"], account["account_id"]),
            )
        )
        assert len(audit_rows) == 1, f"expected exactly one terminal audit row, got {audit_rows}"
        assert audit_rows[0]["action"] == "generation.complete"
        assert audit_rows[0]["status"] == "success"


def test_chunk_writes_do_not_directory_audit_rows(
    app_env: None, fresh_account: dict[str, str]
) -> None:
    """Persisting chunks must not themselves create audit/invocation rows
    (T049 invariant): after chunk writes + finalize, the count is still 1."""
    account = fresh_account
    _run_one_complete_generation(account, chunks=["a", "b"])

    with models.transaction() as conn:
        n_audit = models.fetchone(
            conn.execute(
                """SELECT count(*) AS n FROM audit_log
                   WHERE tenant_id = %s AND account_id = %s AND agent = 'orchestrator'""",
                (account["tenant_id"], account["account_id"]),
            )
        )
        assert n_audit is not None
        assert n_audit["n"] == 1

        n_inv = models.fetchone(
            conn.execute(
                """SELECT count(*) AS n FROM capability_invocations
                   WHERE tenant_id = %s AND account_id = %s AND agent = 'orchestrator'""",
                (account["tenant_id"], account["account_id"]),
            )
        )
        assert n_inv is not None
        assert n_inv["n"] == 1
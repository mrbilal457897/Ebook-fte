"""Hermetic BYOK resolution unit tests (T031 seam, pure logic)."""

import pytest

from orchestrator import byok, config


def test_dev_decrypt_accepts_enc_prefix() -> None:
    assert byok._decrypt_key(b"enc:sk-customer-1") == "sk-customer-1"


def test_dev_decrypt_rejects_other_payloads() -> None:
    with pytest.raises(RuntimeError, match="KMS/age"):
        byok._decrypt_key(b"gobbledygook")


def test_model_name_per_provider() -> None:
    assert byok._model_name_from_provider("gemini", "gemini-flash-latest") == "gemini-flash-latest"
    assert byok._model_name_from_provider("openai", "gpt-4o-mini") == "openai/gpt-4o-mini"
    assert byok._model_name_from_provider("anthropic", "claude-3-haiku") == "anthropic/claude-3-haiku"


def test_platform_resolution_uses_platform_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """credential_id=None resolves to the platform default Gemini key/model"""
    monkeypatch.setenv("DATABASE_URL", "postgres://dev@localhost/dev")
    monkeypatch.setenv("GOOGLE_API_KEY", "platform-key")
    monkeypatch.setenv("CONTENT_AGENT_MODEL", "my-flash-latest")
    config._settings = None
    try:
        resolved = byok.resolve_generation_model(
            conn=None,  # type: ignore[arg-type] - platform path never touches the DB
            tenant_id="t",
            account_id="a",
            credential_id=None,
        )
    finally:
        config._settings = None
    assert resolved is not None
    assert resolved.provider == "platform"
    assert resolved.api_key == "platform-key"
    assert resolved.model == "my-flash-latest"


def test_platform_resolution_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://dev@localhost/dev")
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    config._settings = None
    try:
        with pytest.raises(RuntimeError, match="GOOGLE_API_KEY"):
            byok.resolve_generation_model(
                conn=None,  # type: ignore[arg-type]
                tenant_id="t",
                account_id="a",
                credential_id=None,
            )
    finally:
        config._settings = None


def test_get_model_adapter_refuses_byok_without_live_wiring() -> None:
    spec = byok.ResolvedModel(provider="gemini", api_key="cust-key", model="gemini-flash-latest")
    with pytest.raises(NotImplementedError, match="FR-008"):
        byok.get_model_adapter(spec)
    assert byok.get_model_adapter(
        byok.ResolvedModel(provider="platform", api_key="k", model="m")
    ) is None
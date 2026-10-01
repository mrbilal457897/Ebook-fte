"""Hermetic BYOK resolution + adapter tests (T031 seam, pure logic).

These assert the two things FR-008 actually turns on:

1. A customer's key travels **with the model object**, so ADK cannot fall back
   to the process-wide `GOOGLE_API_KEY`. A returned `Gemini`/`LiteLlm` carrying
   the customer's key is the proof; the platform path returning `None` (meaning
   "use the configured default") is the contrast.
2. A key is never readable unless it is actually encrypted at rest. The
   plaintext `dev:` escape hatch is refused unless explicitly switched on,
   because silently accepting it would defeat the bytea column's purpose.
"""

import base64

import pytest

from orchestrator import byok, config


def _settings(**env: str) -> config.Settings:
    """Build a Settings directly rather than through the env singleton, so a
    test never has to mutate (and reset) process-wide state to exercise one
    provider's config."""
    base = {
        "DATABASE_URL": "postgres://dev@localhost/dev",
        "BYOK_OPENAI_MODEL": "gpt-4o-mini",
        "BYOK_ANTHROPIC_MODEL": "claude-sonnet-4-5",
    }
    base.update(env)
    monkey = pytest.MonkeyPatch()
    for key, value in base.items():
        monkey.setenv(key, value)
    try:
        config._settings = None
        return config.load_settings()
    finally:
        config._settings = None
        monkey.undo()


# --- Key decryption ---------------------------------------------------------


def test_gcm_sealed_key_round_trips() -> None:
    """The production shape: a key sealed by the save path opens back to the
    same plaintext. Built here with the same primitive so the two sides cannot
    drift apart without this test noticing."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = b"sk-customer-round-trip"
    encryption_key = base64.b64encode(bytes(range(32))).decode()
    nonce = bytes(range(12, 24))
    sealed = nonce + AESGCM(base64.b64decode(encryption_key)).encrypt(nonce, raw, None)

    previous = config._settings
    config._settings = _settings(BYOK_ENCRYPTION_KEY=encryption_key)
    try:
        assert byok._decrypt_key(b"gcm:" + sealed) == raw.decode()
    finally:
        config._settings = previous


def test_gcm_blob_requires_the_encryption_key() -> None:
    previous = config._settings
    config._settings = _settings(BYOK_ENCRYPTION_KEY="")
    try:
        with pytest.raises(RuntimeError, match="BYOK_ENCRYPTION_KEY is not configured"):
            byok._decrypt_key(b"gcm:" + bytes(60))
    finally:
        config._settings = previous


def test_tampered_gcm_blob_fails_authentication() -> None:
    """GCM is authenticated, so a mutated blob must raise rather than decrypt
    to garbage that would then be sent to a provider as an API key."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    encryption_key = base64.b64encode(bytes(range(32))).decode()
    nonce = bytes(range(12, 24))
    sealed = bytearray(nonce + AESGCM(base64.b64decode(encryption_key)).encrypt(nonce, b"sk-1", None))
    sealed[-1] ^= 0xFF

    previous = config._settings
    config._settings = _settings(BYOK_ENCRYPTION_KEY=encryption_key)
    try:
        with pytest.raises(RuntimeError, match="failed authentication"):
            byok._decrypt_key(b"gcm:" + bytes(sealed))
    finally:
        config._settings = previous


def test_plaintext_dev_blob_is_refused_unless_explicitly_allowed() -> None:
    previous = config._settings
    config._settings = _settings(ALLOW_PLAINTEXT_BYOK="0")
    try:
        with pytest.raises(RuntimeError, match="ALLOW_PLAINTEXT_BYOK"):
            byok._decrypt_key(b"dev:sk-not-encrypted")
    finally:
        config._settings = previous


def test_plaintext_dev_blob_reads_when_explicitly_allowed() -> None:
    previous = config._settings
    config._settings = _settings(ALLOW_PLAINTEXT_BYOK="1")
    try:
        assert byok._decrypt_key(b"dev:sk-dev-only") == "sk-dev-only"
    finally:
        config._settings = previous


def test_unrecognised_payload_fails_loudly() -> None:
    previous = config._settings
    config._settings = _settings()
    try:
        with pytest.raises(RuntimeError, match="unrecognised prefix"):
            byok._decrypt_key(b"gobbledygook")
    finally:
        config._settings = previous


def test_allow_plaintext_rejects_nonsense_instead_of_defaulting_to_true(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A typo'd flag must not silently mean 'yes' — that would turn on
    unencrypted key storage because of a typo."""
    monkeypatch.setenv("DATABASE_URL", "postgres://dev@localhost/dev")
    monkeypatch.setenv("ALLOW_PLAINTEXT_BYOK", "maybe")
    config._settings = None
    try:
        with pytest.raises(RuntimeError, match="must be a boolean"):
            config.load_settings()
    finally:
        config._settings = None


# --- Model naming -----------------------------------------------------------


def test_model_name_per_provider_is_per_provider_not_a_prefixed_gemini_name() -> None:
    """Each provider gets its own configured name. This used to return
    `openai/gemini-flash-latest`, which no provider can resolve."""
    s = _settings()
    assert byok._model_name_from_provider("gemini", s) == "gemini-flash-latest"
    assert byok._model_name_from_provider("openai", s) == "gpt-4o-mini"
    assert byok._model_name_from_provider("anthropic", s) == "claude-sonnet-4-5"


# --- Platform path ----------------------------------------------------------


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


# --- Adapter: the key must travel with the model ----------------------------


def test_platform_path_builds_no_model_object() -> None:
    """`None` means 'use the configured default from the environment' — the
    pre-BYOK behaviour, unchanged."""
    assert (
        byok.build_model(
            byok.ResolvedModel(provider="platform", api_key="k", model="gemini-flash-latest")
        )
        is None
    )


def test_gemini_byok_builds_a_gemini_model_carrying_the_customer_key() -> None:
    from google.adk.models.google_llm import Gemini

    model = byok.build_model(
        byok.ResolvedModel(provider="gemini", api_key="sk-customer-gemini", model="gemini-flash-latest")
    )
    assert isinstance(model, Gemini)
    assert model.model == "gemini-flash-latest"
    # The key must be on the instance's client kwargs, not read from env.
    assert model.client_kwargs == {"api_key": "sk-customer-gemini"}


def test_openai_byok_builds_a_litellm_model_with_a_provider_qualified_name() -> None:
    from google.adk.models.lite_llm import LiteLlm

    model = byok.build_model(
        byok.ResolvedModel(provider="openai", api_key="sk-customer-openai", model="gpt-4o-mini")
    )
    assert isinstance(model, LiteLlm)
    assert model.model == "openai/gpt-4o-mini", (
        "LiteLLM needs the provider prefix or it cannot route the call"
    )


def test_anthropic_byok_builds_a_litellm_model_with_a_provider_qualified_name() -> None:
    from google.adk.models.lite_llm import LiteLlm

    model = byok.build_model(
        byok.ResolvedModel(
            provider="anthropic", api_key="sk-customer-anthropic", model="claude-sonnet-4-5"
        )
    )
    assert isinstance(model, LiteLlm)
    assert model.model == "anthropic/claude-sonnet-4-5"


def test_unknown_provider_raises_instead_of_silently_falling_back() -> None:
    """The worst possible failure mode would be a BYOK request that quietly ran
    on the platform key, so an unroutable provider must be loud."""
    with pytest.raises(NotImplementedError, match="FR-008"):
        byok.build_model(
            byok.ResolvedModel(provider="cohere", api_key="k", model="m")
        )
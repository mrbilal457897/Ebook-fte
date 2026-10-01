"""BYOK model resolution (T031, FR-008).

Resolution rules that must hold regardless of the live provider path:

- No credential id on the request -> platform default (Gemini, our platform
  key from config). This is the free-tier path.
- A credential id that is missing, not owned by this tenant/account, or
  marked `invalid` -> `None`, which the caller turns into a terminal
  `error` event `{code: "byok_invalid", refunded: true}`. There is **no
  fallback** to the platform key (FR-008, research.md §6, AC7).
- A valid credential -> provider + decrypted key + per-provider model name.
  The key is decrypted in-memory for the request duration only (Article
  VII.2) and never logged.

`build_model` turns a resolved spec into an ADK model object, so every provider
still goes through ADK's model abstraction (Principle 2) — nothing here talks to
a provider SDK directly. Per-provider names are configurable via env, never
hard-coded (Principle 2 / AGENTS.md §5).

Data access stays in `models.get_model_credential` (tenant-scoped, fixed
named statements) — this module only resolves + decrypts + adapts.
"""

from dataclasses import dataclass

from google.adk.models.base_llm import BaseLlm
from psycopg import Connection

from orchestrator import config, models

#: The only providers a customer may bring a key for. Mirrors the
#: `model_credentials.provider` CHECK constraint in db/migrations/0001, so an
#: unknown provider cannot reach `build_model` even if a row somehow said so.
SUPPORTED_PROVIDERS = ("gemini", "openai", "anthropic")


@dataclass(frozen=True)
class ResolvedModel:
    provider: str  # "platform" | "gemini" | "openai" | "anthropic"
    api_key: str
    model: str


def resolve_generation_model(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    credential_id: str | None,
) -> ResolvedModel | None:
    """Resolve the model for a request, or return `None` when the requested
    BYOK credential is invalid/unavailable (caller refunds + errors)."""
    if credential_id is None:
        s = config.get_settings()
        return ResolvedModel(
            provider="platform",
            api_key=s.require_platform_key(),
            model=s.content_agent_model,
        )

    cred = models.get_model_credential(
        conn,
        credential_id=credential_id,
        tenant_id=tenant_id,
        account_id=account_id,
    )
    if cred is None or cred["last_status"] == "invalid":
        return None

    provider = str(cred["provider"])
    if provider not in SUPPORTED_PROVIDERS:
        # A row claiming an unsupported provider is a data defect, not a
        # customer error. Fail closed: no fallback (FR-008), no guess.
        raise NotImplementedError(
            f"model_credentials.provider={provider!r} is not a supported "
            f"BYOK provider {SUPPORTED_PROVIDERS}"
        )

    return ResolvedModel(
        provider=provider,
        api_key=_decrypt_key(cred["encrypted_key"]),
        model=_model_name_from_provider(provider, config.get_settings()),
    )


def build_model(spec: ResolvedModel) -> BaseLlm | None:
    """Build the ADK model object for a resolved spec.

    Returns `None` for the platform path: that run uses the configured
    `GOOGLE_API_KEY` from the environment, exactly as before this existed, and
    ADK constructs the client itself.

    For a customer BYOK key the key must travel *with the model object* — ADK's
    Gemini connection otherwise reads the key from the process environment,
    which would silently use the platform key and violate FR-008. Two routes,
    both ADK's own abstraction (Principle 2):

    - **gemini** -> `Gemini(client_kwargs={"api_key": ...})`. ADK's `Gemini`
      exposes `client_kwargs` for exactly this ("extra arguments to pass to the
      google.genai.Client constructor"), so the key is per-instance and the
      environment is never consulted.
    - **openai / anthropic** -> `LiteLlm(model="<provider>/<name>",
      api_key=...)`, i.e. ADK's LiteLLM integration, which is the sanctioned
      path to these providers for BYOK customers (AGENTS.md §2).

    A key is never stored on the object beyond this call's lifetime, and the
    `ResolvedModel` holding the plaintext key is dropped by the caller once the
    run is built.
    """
    if spec.provider == "platform":
        return None

    if spec.provider == "gemini":
        from google.adk.models.google_llm import Gemini

        return Gemini(model=spec.model, client_kwargs={"api_key": spec.api_key})

    if spec.provider in ("openai", "anthropic"):
        from google.adk.models.lite_llm import LiteLlm

        return LiteLlm(model=f"{spec.provider}/{spec.model}", api_key=spec.api_key)

    # Unreachable while `resolve_generation_model` validates the provider, but a
    # silent fall-through here would be the worst possible shape of bug: it would
    # look like a working BYOK run. Raise instead.
    raise NotImplementedError(
        f"no ADK model adapter for BYOK provider {spec.provider!r}; refusing to "
        "fall back to the platform key (FR-008)"
    )


def _decrypt_key(encrypted: bytes | memoryview) -> str:
    """Decrypt the at-rest key (bytea, data-model.md).

    Production shape is AES-256-GCM under `BYOK_ENCRYPTION_KEY`, written by the
    credential-save path in `frontend/lib/model-credentials.ts` and read here.
    GCM is authenticated, so a tampered blob raises rather than decrypting to
    garbage.

    A `dev:`-prefixed blob is the local-development escape hatch: plaintext, so
    a developer can seed a row by hand without running the service. It is
    refused outright unless `ALLOW_PLAINTEXT_BYOK=1`, because silently accepting
    plaintext at rest is exactly the failure the bytea column exists to prevent.
    """
    raw = bytes(encrypted)
    s = config.get_settings()

    if raw.startswith(b"gcm:"):
        if not s.byok_encryption_key:
            raise RuntimeError(
                "model_credentials.encrypted_key is AES-GCM sealed but "
                "BYOK_ENCRYPTION_KEY is not configured (see .env.example)"
            )
        return _aes_gcm_open(s.byok_encryption_key, raw[len(b"gcm:") :])

    if raw.startswith(b"dev:"):
        if not s.allow_plaintext_byok:
            raise RuntimeError(
                "model_credentials.encrypted_key holds a plaintext 'dev:' blob "
                "and ALLOW_PLAINTEXT_BYOK is not set; refusing to read a key "
                "that is not encrypted at rest (AGENTS.md §5 Secrets)"
            )
        return raw[len(b"dev:") :].decode("utf-8")

    raise RuntimeError(
        "model_credentials.encrypted_key has an unrecognised prefix; expected "
        "'gcm:' (AES-256-GCM) or an explicitly-enabled 'dev:' blob"
    )


def _aes_gcm_open(key_b64: str, sealed: bytes) -> str:
    """Open a `nonce || ciphertext || tag` blob produced by the save path."""
    import base64

    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        key = base64.b64decode(key_b64, validate=True)
    except (ValueError, TypeError) as exc:
        # Any b64 failure is the same config error, so it is reported as one
        # rather than leaking binascii's internals.
        raise RuntimeError("BYOK_ENCRYPTION_KEY must be base64") from exc
    if len(key) != 32:
        raise RuntimeError(
            f"BYOK_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, "
            f"got {len(key)}"
        )
    try:
        return AESGCM(key).decrypt(sealed[:12], sealed[12:], None).decode("utf-8")
    except InvalidTag as exc:
        raise RuntimeError(
            "model_credentials.encrypted_key failed authentication; the row was "
            "tampered with or BYOK_ENCRYPTION_KEY is wrong"
        ) from exc


def _model_name_from_provider(provider: str, settings: config.Settings) -> str:
    """The model name to use for a BYOK provider.

    Deliberately per-provider rather than reusing `content_agent_model`: a Gemini
    model name is not a valid OpenAI or Anthropic model, and prefixing the Gemini
    name (`openai/gemini-flash-latest`, which this function used to return) would
    hand LiteLLM a name no provider can resolve. Every name is env-configurable
    per AGENTS.md §5, and the provider prefix is added by `build_model`.
    """
    return {
        "gemini": settings.byok_gemini_model,
        "openai": settings.byok_openai_model,
        "anthropic": settings.byok_anthropic_model,
    }[provider]
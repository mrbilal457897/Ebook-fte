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

Data access stays in `models.get_model_credential` (tenant-scoped, fixed
named statements) — this module only resolves + decrypts.
"""

from dataclasses import dataclass

from psycopg import Connection

from orchestrator import config, models


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

    return ResolvedModel(
        provider=cred["provider"],
        api_key=_decrypt_key(cred["encrypted_key"]),
        model=_model_name_from_provider(cred["provider"], config.get_settings().content_agent_model),
    )


def get_model_adapter(spec: ResolvedModel) -> None:
    """Resolve the ADK model object/identifier for a per-request credential.

    The platform path (`provider == "platform"`) needs no adapter — the agent
    runs on the platform GOOGLE_API_KEY from config/env.

    For a customer BYOK key, ADK 2.9.2 exposes no per-request key seam on the
    Gemini connection (keys come from env); the OpenAI/Anthropic path needs
    `google-adk[extensions]` (LiteLLM). Wiring that against a live provider is
    a quickstart-env concern (T046) — raise loudly here so a customer BYOK
    attempt never silently falls back to the platform key (FR-008).
    """
    if spec.provider == "platform":
        return
    raise NotImplementedError(
        "live BYOK connection not wired for provider "
        f"{spec.provider!r} — requires the quickstart env "
        "(google-adk[extensions] for LiteLLM providers); refusing to fall "
        "back to the platform key (FR-008)"
    )


def _decrypt_key(encrypted: bytes | memoryview) -> str:
    """Decrypt the at-rest key (bytea, data-model.md).

    Production deployments must wire KMS/age. For local dev only, a key may
    be stored as `enc:` + UTF-8 plaintext (dev seed). Any other payload shape
    fails loudly rather than guessing.
    """
    raw = bytes(encrypted)
    prefix = b"enc:"
    if raw.startswith(prefix):
        return raw[len(prefix) :].decode("utf-8")
    raise RuntimeError(
        "model_credentials.encrypted_key is not decodable: wire KMS/age "
        "decryption (data-model.md); dev rows must be 'enc:' + plaintext"
    )


def _model_name_from_provider(provider: str, base_model: str) -> str:
    # Gemini: `gemini-flash-latest` w/ a per-customer API key value.
    # OpenAI/Anthropic: LiteLLM-style `openai/...`, `anthropic/...`.
    if provider == "gemini":
        return base_model
    return f"{provider}/{base_model}"
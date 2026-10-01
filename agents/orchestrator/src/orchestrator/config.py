"""Runtime configuration for the Orchestrator.

All env reads live here — never scattered across modules (T008 left only
`DATABASE_URL`; T014 completes the set). Values are per-task-type
configurable, nothing hard-coded (Constitution Article VII.1-2; AGENTS.md
Principle 2).
"""

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}") from None


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a float, got {raw!r}") from None


def _bool_env(name: str, default: bool) -> bool:
    """Parse a boolean env flag.

    Only the spellings a human actually types are accepted, and anything else
    raises. This matters more than usual for `ALLOW_PLAINTEXT_BYOK`: a silently
    misread flag that defaulted to *allowing* plaintext BYOK at rest would defeat
    the encryption the column exists to provide (AGENTS.md §5 Secrets).
    """
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    raise RuntimeError(f"{name} must be a boolean (1/0/true/false/yes/no), got {raw!r}")


@dataclass(frozen=True)
class GenerationParams:
    temperature: float
    top_p: float
    max_tokens: int


@dataclass(frozen=True)
class Settings:
    # --- Postgres system of record ---
    database_url: str

    # --- Model / provider (ADK abstraction; Gemini default platform key) ---
    orchestrator_model: str
    content_agent_model: str
    platform_api_key: str

    # --- Internal service auth (Next.js proxy -> this service) ---
    internal_auth_token: str

    # --- Free-tier + lease ---
    free_tier_limit: int
    lease_window_seconds: int

    # --- Per-device/IP rate limits (FR-002; values config-driven, Q4) ---
    rate_limit_device_max: int
    rate_limit_ip_max: int
    rate_limit_window_seconds: int

    # --- BYOK (Principle 3: encrypted at rest, per-request, never logged) ---
    byok_encryption_key: str
    allow_plaintext_byok: bool
    byok_gemini_model: str
    byok_openai_model: str
    byok_anthropic_model: str

    # --- Lago billing (upgrade-trigger shape only this slice) ---
    lago_api_url: str
    lago_api_key: str

    # --- Per-task-type generation params (configurable, not hard-coded) ---
    task_params: dict[str, GenerationParams] = field(default_factory=dict)

    def generation_params_for(self, task_type: str) -> GenerationParams:
        return self.task_params.get(
            task_type, self.task_params.get("default", _DEFAULT_PARAMS)
        )

    def require_platform_key(self) -> str:
        if not self.platform_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY (platform key) is required for free-tier "
                "default-model generations (see .env.example)"
            )
        return self.platform_api_key


_DEFAULT_PARAMS = GenerationParams(temperature=0.8, top_p=0.95, max_tokens=8192)

_settings: Settings | None = None


def load_settings() -> Settings:
    database_url = _env("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required (e.g. postgres://user:pass@localhost:5432/ebookfte)"
        )

    task_params = {
        "default": GenerationParams(
            temperature=_float_env("GENERATION_TEMPERATURE", 0.8),
            top_p=_float_env("GENERATION_TOP_P", 0.95),
            max_tokens=_int_env("GENERATION_MAX_TOKENS", 8192),
        ),
        "book_content": GenerationParams(
            temperature=_float_env("BOOK_CONTENT_TEMPERATURE", 0.8),
            top_p=_float_env("BOOK_CONTENT_TOP_P", 0.95),
            max_tokens=_int_env("BOOK_CONTENT_MAX_TOKENS", 8192),
        ),
    }

    return Settings(
        database_url=database_url,
        orchestrator_model=_env("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
        content_agent_model=_env("CONTENT_AGENT_MODEL", "gemini-flash-latest"),
        platform_api_key=_env("GOOGLE_API_KEY"),
        task_params=task_params,
        internal_auth_token=_env("INTERNAL_AUTH_TOKEN"),
        free_tier_limit=_int_env("FREE_TIER_LIMIT", 3),
        lease_window_seconds=_int_env("LEASE_WINDOW_SECONDS", 60),
        rate_limit_device_max=_int_env("RATE_LIMIT_DEVICE_MAX", 10),
        rate_limit_ip_max=_int_env("RATE_LIMIT_IP_MAX", 30),
        rate_limit_window_seconds=_int_env("RATE_LIMIT_WINDOW_SECONDS", 60),
        byok_encryption_key=_env("BYOK_ENCRYPTION_KEY"),
        allow_plaintext_byok=_bool_env("ALLOW_PLAINTEXT_BYOK", False),
        byok_gemini_model=_env("BYOK_GEMINI_MODEL", "gemini-flash-latest"),
        byok_openai_model=_env("BYOK_OPENAI_MODEL", "gpt-4.1-mini"),
        byok_anthropic_model=_env("BYOK_ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        lago_api_url=_env("LAGO_API_URL", "http://localhost:3001/api/v1"),
        lago_api_key=_env("LAGO_API_KEY"),
    )


def get_settings() -> Settings:
    """Lazy settings singleton; loads on first call so module imports stay
    side-effect free (a missing `DATABASE_URL` surfaces at request/use time,
    not at `import orchestrator.config` time — keeps imports green during
    build and in DB-less test collection)."""
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings
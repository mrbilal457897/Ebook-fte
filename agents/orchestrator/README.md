# orchestrator

The Orchestrator agent and its HTTP service. Top-level ADK agent: interprets
end-customer intent, enforces policy, and routes to specialists (AGENTS.md §4).
This is the only process a customer's browser ever talks to.

**Slice:** 001 (free-tier content generation) — built here.
Later slices added the specialist roster: 002 (this service calls the
`ebook-data` MCP server) and 003 (four specialists attached as sub-agents).
Spec: `specs/001-free-tier-content-generation/spec.md`.

## What it is

- **FastAPI/uvicorn service** exposing `POST /v1/generate` as a Server-Sent
  Events stream, plus pre-stream JSON rejections.
- **ADK multi-agent composition.** `build_orchestrator()` attaches the Content
  Agent and the Cover Design, Formatting, and Publishing Advisor agents as
  `sub_agents`. Agents are built **fresh per call** — ADK assigns a parent on
  composition, so a module-level singleton fails the second build.
- **Gate** (`gate.py`): the free-tier counter, the single-in-flight lease, and
  per-device/IP rate limiting, all as atomic DB statements with race-condition
  tests.
- **BYOK resolution** (`byok.py`): a customer's own model key, decrypted in
  memory for the request. An auth failure is a terminal `byok_invalid` error
  with a refund — never a silent fallback to the platform key.
- **Audit invariant**: exactly one `capability_invocations` row and one
  terminal `audit_log` row per generation, in the same transaction as the
  final write. Every code path, including failures, is covered.
- **Incremental persistence** (`persistence.py`): each streamed chunk is
  committed and the lease renewed *before* the token is emitted, so UI content
  never diverges from stored content and an interrupted generation is still
  fully retrievable.

### Recorded deviation

`persistence.py` holds direct SQL for exactly three transaction shapes —
`persist_chunk`, `finalize_generation`, `fail_generation`. They must share one
commit with the in-flight lease row, which an HTTP hop to the MCP server cannot
do. Sanctioned in `specs/002-ebook-data-mcp/spec.md` §7; no other direct-SQL
call may be added here.

## Run

```sh
export DATABASE_URL='postgres://user:pass@localhost:5432/ebookfte'
export GOOGLE_API_KEY='...'          # platform key for free-tier requests
export INTERNAL_AUTH_TOKEN='...'     # token the Next.js proxy presents
uv sync
uv run uvicorn orchestrator.server:app --port 8080
```

Env is read from the repo-root `.env` (see `.env.example`): `DATABASE_URL`,
`GOOGLE_API_KEY`, `INTERNAL_AUTH_TOKEN`, `ORCHESTRATOR_MODEL`,
`FREE_TIER_LIMIT`, `LEASE_WINDOW_SECONDS`, `RATE_LIMIT_*`, `GENERATION_*` /
`BOOK_CONTENT_*` params, `EBOOK_DATA_URL`.

## Test

```sh
uv run pytest          # DB-backed tests SKIP explicitly when DATABASE_URL is unset
uv run ruff check .
uv run pyright
```

`tests/fake_llm.py` provides a deterministic in-process LLM, so the suite has
no provider dependency. `tests/e2e_ac1_ac7.py` drives AC1–AC7 end to end
against a real database.

# Quickstart: Validating Slice 1 End-to-End

**Feature**: [spec.md](spec.md) — runnable validation scenarios for AC1–AC7.
Design facts: [plan.md](plan.md), [data-model.md](data-model.md), and the
interfaces in [contracts/](contracts/README.md). Implementation details live
in `tasks.md`.

## Prerequisites

- `uv` (Python 3.12), Node.js 20+ with `npm`.
- Postgres + pgvector running locally; migrations applied (schema in
  `db/migrations/`).
- One seeded tenant (slug + name) for sign-up linkage testing.
- An ADK/Gemini default key and a throwaway invalid BYOK key for failure
  tests. All keys live only in `.env` (git-ignored); `.env.example` lists
  every variable.
- Auth vendor ratified (per [research.md](research.md) §1) before these runs
  require Task 1 wiring; until then sign-in stubs may be used for the
  backend-only checks.

## Run

```bash
# agent services
cd agents/orchestrator && uv sync && uv run pytest
cd agents/content-agent  && uv run pytest
uv run ruff check . && uv run pyright

# frontend
cd frontend && npm run lint && npm run test

# services up
agents/orchestrator: uv run uvicorn orchestrator.server:app   # :8080
frontend:            npm run dev                              # :3000
```

## Validation scenarios (map to ACs)

### AC1 — signed-out requests are rejected with nothing stored

1. Without a session, `POST /api/generate` with any prompt.
2. Expect `401 {"code":"signed_out"}`.
3. In `psql`: `SELECT count(*) FROM content_versions; SELECT count(*) FROM
   capability_invocations; SELECT count(*) FROM audit_log;` → all `0` for the
   new account scope.

### AC2 — four attempts → exactly 3 generations, counter reads 3

1. Create one account (`free_tier_limit = 3`).
2. Fire **4 concurrent** `POST /api/generate` (or direct `/v1/generate`)
   requests (concurrency via `httpx.AsyncClient`/a script).
3. Expect exactly 3 streams succeed (with `version` events), the 4th returns
   `402 free_tier_exhausted` (or a rejected 409 in the concurrent-lease case),
   **no model call** for the blocked one (spy on the model runner).
4. `SELECT free_tier_count FROM accounts WHERE id = …;` → `3`, never `4`.

### AC3 — first token ≤ 2 s under normal load

1. Start a generation; timestamp at request start, timestamp on the first
   `token` event in the UI (or the stream reader).
2. Expect first-token latency < 2 s on a local run with the default model.
   (Manual for the UI-timing clause; note "under normal load" per spec.)

### AC4 — mid-generation refresh does not lose content

1. Start a generation; let ~10 chunks stream; refresh/close the page.
2. `GET /api/generation/[id]` with the id from the first `token`/session.
3. Expect 200 with `isPartial: true` and `content` exactly equal to the text
   the UI had rendered before the refresh (compare diff).

### AC5 — exactly one invocation + one audit row, correct tenant

1. Run one successful generation.
2. Expect exactly 1 `capability_invocations` row and exactly 1 terminal
   `audit_log` row, both with `tenant_id` matching the account's tenant, and
   `content_versions.is_partial = false`.

### AC6 — second concurrent generation is rejected

1. Hold one generation open (slow prompt / large book).
2. `POST /api/generate` again from the same account (second device).
3. Expect `409 {"code":"already_in_progress"}` — not queued, not parallel.
4. After the lease self-expires (no terminal event), a new request is accepted
   again (Clarification Q2).

### AC7 — invalid/expired BYOK fails clearly, consumes nothing

1. Stub the provider to return an auth failure (or use a dead key).
2. `POST /api/generate` with `modelCredentialId` pointing at that credential.
3. Expect an `error` event `{code:"byok_invalid", refunded:true}`; no fallback
   to the platform key (spy: default model never invoked).
4. `free_tier_count` unchanged; `free_tier_limit` never billed.

## Failure-path tests that must exist (Constitution Article X)

- Declined/awaiting BYOK, provider-stream error, `already_in_progress` (409),
  `free_tier_exhausted` (402), and the atomic-counter race (AC2's 4-way
  concurrent) all have automated tests, not just happy paths.

## Expected final state

All seven scenarios green in CI output (pytest + Vitest), plus the manual
first-token timing spot-check. The exhaustive `version`/`error` events and
lease-expiry behavior follow the contracts in `contracts/`.
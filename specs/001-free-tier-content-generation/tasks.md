# Tasks: Free-Tier Real-Time Content Generation (Slice 1)

**Input**: Design documents from `specs/001-free-tier-content-generation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (all present)

**Tests**: This feature explicitly requests automated tests (plan.md Build Sequence, quickstart.md AC scenarios, Constitution Article X failure-path rule) — test tasks are included, written FIRST, and must FAIL before implementation of the code they cover.

**Organization**: Tasks are grouped by user story so each story can be implemented independently, tested independently, and delivered as an MVP increment. **Auth vendor is RATIFIED (Better Auth, 2026-09-19)** — Task T009 is unblocked; the blocking item from the draft task context is resolved per research.md §1.

## Format

- `- [ ] T### [P] [Story?] Description with exact file path`
- `[P]` = parallelizable (different files, no cross-dependencies)
- `[Story]` label appears only in user-story phases (US1..US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create `db/migrations/` per plan.md project structure with the migration mechanism (repo migration convention: plain SQL vs. alembic settled at migration authoring time per data-model.md) and a `db/migrations/README.md` documenting the convention.
- [X] T002 [P] Scaffold `frontend/` — Next.js 15 (App Router, TypeScript) via `create-next-app`, with the directory structure from plan.md: `app/(auth)/signup/`, `app/(auth)/signin/`, `app/generate/`, `app/api/generate/route.ts`, `app/api/generation/[id]/route.ts`, `app/api/account/route.ts`, `lib/`, `components/`, `tests/`. Pin exact versions in `frontend/package.json` for GSAP, the streaming client, and the ADK-facing API client (AGENTS.md §5 Frontend pinning rule).
- [X] T003 [P] Confirm/complete the two Python uv projects already present at `agents/orchestrator/` (pyproject.toml + uv.lock committed; `google-adk==2.9.2` pinned) and `agents/content-agent/` (same conventions) — add pinned `mcp` and Postgres/pgvector client only where the build actually adds them (AGENTS.md §5 version-lock rule; Principle 10: prefer what exists, do not precursor dependencies).
- [X] T004 [P] Configure lint/type tooling per AGENTS.md §5: `ruff` + `pyright` (via `uv add --dev`) in both `agents/orchestrator/pyproject.toml` and `agents/content-agent/pyproject.toml`; ESLint + Prettier + Vitest in `frontend/`.
- [X] T005 Create repo-root `.env.example` listing every required variable with a placeholder: `DATABASE_URL`, `ORCHESTRATOR_MODEL`, `CONTENT_AGENT_MODEL`, Gemini/ADK platform key, `INTERNAL_AUTH_TOKEN`, Better Auth secrets (`BETTER_AUTH_SECRET` + session encryption key), `LAGO_API_URL`/`LAGO_API_KEY`. Real `.env` is git-ignored; agent never reads the real file back (AGENTS.md §5 — Secrets).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Write the schema migration in `db/migrations/` creating the 10 tables this slice touches (data-model.md): `tenants`, `accounts`, `books`, `content_versions`, `conversations`, `run_states`, `capability_invocations`, `audit_log`, `model_credentials`, `rate_limit_counts`. Every table carries `tenant_id`; `accounts`: unique `(tenant_id, email)` + unique `(tenant_id, auth_subject)`, `free_tier_count` default 0, `free_tier_limit` default 3; `run_states`: unique live-lease on `(account_id, kind)`, `lock_expires_at`; `rate_limit_counts`: unique `(tenant_id, account_id, kind, scope_key, window_start)`.
- [X] T007 Add a dev seed in `db/migrations/` (or a git-ignored `db/seeds/seeds.sql`) inserting one tenant (slug + name) for sign-up-linkage testing (quickstart prerequisite).
- [ ] T008 [P] Implement the Orchestrator DB access layer in `agents/orchestrator/src/orchestrator/models.py` — orchestration code with fixed, named, tenant-scoped statements (Article IV.3: no agent-facing run-SQL/run-code tool).
- [ ] T009 [P] Integrate Better Auth (RATIFIED 2026-09-19) behind the narrow `lib/auth` seam in `frontend/lib/auth/`: server+client init, Postgres DB-backed sessions/users, email/password + OAuth provider wired (research.md §1; no middleware-only auth — enforce in route handler/DAL per CVE-2025-29927 note).
- [ ] T010 [P] Implement tenancy derivation helper in `frontend/lib/tenancy.ts` — `tenant_id` derived from the authenticated session at the boundary, never from client text or model output (Article IV.5).
- [ ] T011 [P] ADK streaming spike test in `agents/orchestrator/tests/test_stream_api.py` verifying exact `Event` field names for partial text / `LLM_Chunk` / `LLM_Complete` on the installed pinned `google-adk==2.9.2` (research.md §3 detail-to-verify requirement).
- [ ] T012 Implement the atomic free-tier counter + refund in `agents/orchestrator/src/orchestrator/gate.py`: `UPDATE accounts SET free_tier_count = free_tier_count + 1 WHERE id = :acct AND tenant_id = :tenant AND free_tier_count < :limit RETURNING free_tier_count`, and the decrement (refund) path — refunds only for provider/BYOK failures (FR-007, Clarification Q1). Concurrency test written FIRST in `agents/orchestrator/tests/test_gate_race.py`.
- [ ] T013 [P] Implement the in-flight lease primitives in `agents/orchestrator/src/orchestrator/gate.py`: guarded INSERT into `run_states` (`kind='generation'`, `lock_expires_at = now() + window`), lease renewal, and self-expiry check treating expired leases as free (FR-009, Clarification Q2).
- [ ] T014 Implement config/env handling in `agents/orchestrator/src/orchestrator/config.py`: `DATABASE_URL`, model + generation params (configurable per task type, not hard-coded), device/IP rate-limit thresholds (config-driven, tuned later per Clarification Q4), Lago URL, internal-token secret. Add matching keys to `.env.example` (sync T005).
- [ ] T015 [P] [US2] Test "device/IP rate limit holds under concurrency" (FR-002): fire N parallel `POST /v1/generate` requests from one device key / one IP key while the configured `rate_limit_counts` threshold is exactly at/below the concurrent burst; assert every request beyond the threshold returns `429 {"code":"rate_limited"}` pre-stream, zero `content_versions`/`capability_invocations`/terminal audit rows, and only `rate_limit.blocked` audit rows appear — written FIRST in `agents/orchestrator/tests/test_rate_limit_race.py` before T016, mirroring T012's gate-race approach.
- [ ] T016 Implement atomic device/IP rate limiting in `agents/orchestrator/src/orchestrator/gate.py` (admitted only for requests free-tier-eligible) + `frontend/lib/rate-limit.ts` (device fingerprint + client IP → SHA-256 keys, never raw): thresholds for each kind + window read from `agents/orchestrator/src/orchestrator/config.py` (T014-level config keys `RATE_LIMIT_DEVICE_MAX`, `RATE_LIMIT_IP_MAX`, `RATE_LIMIT_WINDOW_SECONDS`) and forwarded under `rateLimitContext` in the internal contract (contracts/orchestrator-api.md); atomic INSERT…ON CONFLICT per (tenant_id, account_id, kind, scope_key, window_start), over-limit → `rate_limited` reject BEFORE the free-tier admit and the in-flight lease, no model call, no credit, only a `rate_limit.blocked` audit row (FR-002). (Depends on T012, T014.)
- [ ] T017 Implement the Orchestrator server skeleton in `agents/orchestrator/src/orchestrator/server.py` (FastAPI/uvicorn on :8080 per quickstart): `POST /v1/generate` SSE endpoint, short-lived internal-token auth dependency, JSON pre-stream rejections mirroring the external contract codes (`invalid_prompt`, `already_in_progress`, `free_tier_exhausted`).
- [ ] T018 Wire the ADK Orchestrator composition in `agents/orchestrator/src/orchestrator/agent.py`: set `SYSTEM_PROMPT` from the ratified `contracts/orchestrator-prompt.md` (Build Task 3 source), add the Content Agent sub-agent (path dependency on `agents/content-agent`), and keep the streaming-relay + available-specialist scoping (only Content Agent wired this slice; "coming soon" for others).

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Sign-Up and Tenant Linkage (Priority: P1) 🎯 MVP

**Goal**: A new end-customer arrives through a tenant entry point and signs up by email or OAuth; an account is created, linked to that tenant, and enabled for exactly 3 free generations. Signing in is the gate for everything else (FR-001, FR-010).

**Independent Test**: A brand-new visitor signs up through a tenant entry point; the account is bound to the correct tenant with a 3-generation allowance. Fully demonstrable with no generation run.

### Tests for User Story 1 (explicitly requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T019 [P] [US1] Test "signed-out generation is rejected with nothing stored": `POST /api/generate` without a session → `401 {"code":"signed_out"}` and zero new rows in `content_versions`/`capability_invocations`/`audit_log` (FR-001, AC1, spec scenario 3) in `frontend/tests/generate.gate.test.ts`.
- [ ] T020 [P] [US1] Test "sign-up binds account to arriving tenant": new user signs up by email and by OAuth via a tenant slug → one `accounts` row linked to the correct `tenant_id`, `free_tier_count = 0`, `free_tier_limit = 3` (FR-010, spec scenario 1) in `frontend/tests/signup.link.test.ts`.

### Implementation for User Story 1

- [ ] T021 [P] [US1] Sign-up/sign-in pages using the auth seam: `frontend/app/(auth)/signup/page.tsx` and `frontend/app/(auth)/signin/page.tsx` (email/password + OAuth buttons per ebook-fte-design-system skill).
- [ ] T022 [US1] First-sign-in handler in `frontend/lib/auth/` (or DAL per T009 note): create the `accounts` row on first successful sign-in, `tenant_id` from the entry slug the visitor arrived through, `auth_subject` bound, email normalized/case-folded (data-model.md; scenario 1). (Depends on T009, T010, T021.)
- [ ] T023 [US1] Enforce the auth gate in `frontend/app/api/generate/route.ts` at the route-handler/DAL level (not middleware-only per CVE note): signed-out → `401 signed_out`, no rows created, no model call (FR-001). Streaming proxy logic arrives in US2.

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - First Real-Time Generation (Priority: P1)

**Goal**: A signed-in customer enters a book prompt and submits it; the request is routed via the Orchestrator to the Content Agent — never directly to the agent (FR-003) — and generated text streams into the UI token-by-token. Every token shown is saved incrementally so nothing produced is ever lost (FR-004, FR-005).

**Independent Test**: A signed-in customer (free tier or working BYOK) submits a prompt and watches a full book draft stream into the UI in real time, with the streamed content persisted behind the scenes.

### Tests for User Story 2 (explicitly requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T024 [P] [US2] Test "request is routed through Orchestrator to Content Agent and streams": eligible signed-in request → `token` events arrive and a terminal `version` event completes with `isPartial:false` (FR-003, FR-004; contracts/generation-api.md wire example) in `agents/orchestrator/tests/test_generate_stream.py`.
- [ ] T025 [P] [US2] Test "first token within 2 s under normal load": from request start to first `token` event < 2 s in a normalized local run (FR-004, AC3, spec scenario 2; manual UI-timing clause per quickstart) in `agents/orchestrator/tests/test_first_token.py`.
- [ ] T026 [P] [US2] Test "streamed content is persisted incrementally": content visible in the UI and `content_versions.content` never diverge at any chunk boundary; `is_partial` stays `true` until terminal (FR-005, AC4 groundwork, spec scenario 3) in `agents/orchestrator/tests/test_persist_incremental.py`.
- [ ] T027 [P] [US2] Test "invalid/expired BYOK fails cleanly": request with a dead credential → terminal `error` event `{code:"byok_invalid", refunded:true}`, NO fallback to platform key (spy), `free_tier_count`/platform credit unchanged (FR-008, AC7) in `agents/orchestrator/tests/test_byok_failure.py`.
- [ ] T028 [P] [US2] Test "exactly one invocation + one terminal audit row per generation": one successful generation → exactly 1 `capability_invocations` + 1 terminal `audit_log` row (`generation.complete`), both `tenant_id`-scoped, same transaction as the final content write, `is_partial=false` (FR-006, AC5) in `agents/orchestrator/tests/test_audit_invariant.py`.
- [ ] T029 [P] [US2] Frontend test "SSE client reads the stream": `fetch` POST, `ReadableStream` reader, parses `token`/`version`/`error`, aborts reader on unmount/refresh (contracts/generation-api.md client requirements) in `frontend/tests/sse.client.test.ts`.

### Implementation for User Story 2

- [ ] T030 [US2] Orchestrator admission + routing flow in `agents/orchestrator/src/orchestrator/server.py` + `gate.py`: on an eligible request, acquire lease, resolve model (default Gemini or per-request BYOK via `model_credentials`), run the Content Agent via ADK async runner, stream events (research.md §3). (Depends on T012–T018.)
- [ ] T031 [P] [US2] BYOK resolution in `agents/orchestrator/src/orchestrator/models.py` (or `gate.py`): resolve `accounts.active_byok_credential_id`, decrypt key in-memory only, configure ADK model per request (Gemini BYOK = customer key; OpenAI/Anthropic via LiteLLM); auth failure → `byok_invalid`, refund credit, NO fallback (FR-008, research.md §6).
- [ ] T032 [US2] Incremental persistence in `agents/orchestrator/src/orchestrator/persistence.py`: append each chunk to `content_versions.content`, bump `updated_at`, renew lease per chunk, commit BEFORE emitting each `token` event (FR-005, research.md §7); terminal writes flip `is_partial=false` + write invocation/audit rows in the same transaction (FR-006).
- [ ] T033 [US2] `GET /api/account` route in `frontend/app/api/account/route.ts`: auth-required; read `accounts` (`free_tier_count`, `free_tier_limit`), the active BYOK credential's provider, and any live `run_states` lease — resolved from the authenticated session via the DAL/auth seam (`frontend/lib/tenancy.ts`; never from the body). Return exactly per contracts/generation-api.md §GET /api/account: `200 → { "freeTier": { "used": n, "limit": 3, "remaining": m }, "inFlight": bool, "activeByokProvider": "gemini"|"openai"|"anthropic"|null }`. Drives the allowance display, the US3 exhaustion/upgrade prompt, and cross-device in-flight state (FR-009, FR-011). (Depends on T009, T022, T031.)
- [ ] T034 [P] [US2] Wire contract-level step in `agents/orchestrator/src/orchestrator/stream.py` mapping ADK partial events → SSE `token` events and terminal → `version`/`error` exactly per contracts/generation-api.md / orchestrator-api.md (integration for T011 spike). (Depends on T033.)
- [ ] T035 [US2] Next.js proxy route in `frontend/app/api/generate/route.ts`: forward authed request to Orchestrator with internal token + `accountRef {tenantId, accountId}` derived from session (never from body), return `new Response(stream)` immediately with SSE discipline headers (`Content-Type: text/event-stream`, `Connection: keep-alive`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `runtime='nodejs'`, `dynamic='force-dynamic'`), proxy `token`/`version`/`error` and JSON pre-stream errors untouched (research.md §2). (Depends on T023, T030.)
- [ ] T036 [US2] Streaming UI in `frontend/app/generate/page.tsx` + `frontend/components/` (composer, stream panel, allowance countdown per ebook-fte-design-system): POST + ReadableStream reader, token-by-token render, "still working" state on slow first token, "generation stopped" on error/close.

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Free-Tier Exhaustion and Upgrade Prompt (Priority: P2)

**Goal**: After 3 generations the 4th attempt is blocked before any model call; the counter never exceeds 3 even under a near-simultaneous race for the last credit; the customer sees an upgrade prompt that initiates the subscription-flow entry point (FR-007, FR-011; the checkout flow itself is a separate slice).

**Independent Test**: Four generation attempts by one account. Exactly 3 succeed, the 4th is blocked with no model work, the counter reads 3, and an upgrade prompt appears.

### Tests for User Story 3 (explicitly requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T037 [P] [US3] Test "4th attempt blocked before model call": account with `free_tier_count = 3` → next `POST /api/generate` (or `/v1/generate`) rejected with `402 {"code":"free_tier_exhausted","upgrade":true}` before any model call; no invocation/audit rows for the blocked attempt; counter still 3 (FR-007, AC2, spec scenario 1) in `agents/orchestrator/tests/test_exhaustion.py`.
- [ ] T038 [P] [US3] Test "near-simultaneous race for the last credit": account with 2 used → two concurrent requests → exactly one admitted, counter reads 3, the other blocked (FR-007, AC2, spec scenario 2) in `agents/orchestrator/tests/test_free_tier_race.py`.

### Implementation for User Story 3

- [ ] T039 [US3] Exhaustion branch in `agents/orchestrator/src/orchestrator/gate.py` + `server.py`: admission gate short-circuits with `402 free_tier_exhausted` (JSON, pre-stream) when `free_tier_count >= limit`, no model call, no lease, no rows (FR-007). (Depends on T012.)
- [ ] T040 [US3] Upgrade prompt + subscription entry trigger in `frontend/components/` + `frontend/lib/billing/` (or `lib/upgrade.ts`): on `402 free_tier_exhausted`, show the upgrade modal/prompt per ebook-fte-design-system skill that initiates the Lago checkout entry call (FR-011; only the trigger, pinned Lago client, checkout flow deferred).

**Checkpoint**: User Story 3 fully functional.

---

## Phase 6: User Story 4 - Interruption Resilience and Single-Active-Generation (Priority: P2)

**Goal**: Closing or refreshing mid-generation never loses content already generated — the customer can retrieve what was written so far. Only one generation may be in flight per account at a time; a second attempt (any device) is rejected with a clear "already in progress" response, never queued silently or run in parallel (FR-009).

**Independent Test**: Start a generation, refresh mid-stream, and confirm the saved content survives; then, while a generation is in flight, confirm a second request from the same account is rejected.

### Tests for User Story 4 (explicitly requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T041 [P] [US4] Test "interruption keeps all content retrievable": start generation, let ~10 chunks stream, refresh/close → `GET /api/generation/[id]` returns `200` with `isPartial:true` and `content` exactly equal to what the UI rendered before the interruption (FR-005, AC4, spec scenario 1) in `frontend/tests/generation.refetch.test.ts` + a backend variant in `agents/orchestrator/tests/test_interruption.py`.
- [ ] T042 [P] [US4] Test "second concurrent generation rejected": hold one generation open → second `POST /api/generate` from the same account → `409 {"code":"already_in_progress"}`, not queued, not parallel; after lease self-expiry (no terminal event) a new request is accepted (FR-009, AC6, spec scenarios 2+3, Edge Case "stale in-flight lock") in `agents/orchestrator/tests/test_inflight_lease.py`.

### Implementation for User Story 4

- [ ] T043 [US4] Enforce the single-in-flight lease in `agents/orchestrator/src/orchestrator/gate.py` + `server.py`: guarded `run_states` insert (unique live lease per account) → present+unexpired ⇒ `409 already_in_progress`; renew per `token`; release on terminal; expired lease treated as free (FR-009, Clarification Q2). (Depends on T013, T030.)
- [ ] T044 [US4] Saved-content re-fetch endpoint in `frontend/app/api/generation/[id]/route.ts`: auth required, `404` if the version is not in the caller's tenant, returns `{versionId, bookId, conversationId, content, isPartial, updatedAt}` (AC4; contracts/generation-api.md).
- [ ] T045 [US4] Frontend interruption UX in `frontend/app/generate/page.tsx` + `frontend/components/stream/`: on unmount/refresh abort the SSE reader and show "generation stopped"; on re-open, offer re-fetch of the saved partial via `GET /api/generation/[id]`; re-submit starts a FRESH generation (no resume — Assumption, spec scenario 3).

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T046 End-to-end quickstart.md validation: run AC1–AC7 exactly as documented with both services up (orchestrator :8080, frontend :3000); record results per scenario (constitution Article VI.4 — one commit per step already holds).
- [ ] T047 [P] Run `uv run ruff check . && uv run pyright` in both `agents/orchestrator/` and `agents/content-agent/`, and `npm run lint` + Vitest in `frontend/`; fix everything to green (AGENTS.md §5, Article X).
- [ ] T048 [P] Cross-cut the sneaky failure cases per quickstart "Failure-path tests that must exist": BYOK auth failure, provider stream error, `409 already_in_progress`, `402 free_tier_exhausted`, atomic-counter race — confirm each has an automated test (Article X).
- [ ] T049 [P] Final audit-log invariant sweep: confirm exactly one terminal `audit_log` row per generation in ALL paths including provider-failed (`generation.failed`) and no spurious rows from chunk writes (use `persistence.chunk` action if chunks are logged; data-model.md audit rule).
- [ ] T050 [P] Docs sync: `specs/001-free-tier-content-generation/tasks.md` marks tasks complete; quickstart validated; AGENTS.md unchanged (no new rules needed); `.env.example` final sync.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phases 3–6)**: All depend on Foundational completion; then they may proceed in parallel (staff aside) or in priority order P1 → P2.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on other stories.
- **US2 (P1)**: Starts after Foundational; depends on US1's auth gate (T023 present when T035 wires the proxy).
- **US3 (P2)**: Starts after Foundational + US2 admission flow (reuses T012).
- **US4 (P2)**: Starts after Foundational + US2 persistence/streaming (reuses T013, T032).

### Within Each User Story

- Tests (included) are written and FAIL before implementation.
- Models/data-access before endpoints; core gating before UI.

### Parallel Opportunities

- All Setup tasks marked [P] run in parallel.
- Foundational [P] tasks (T008–T011, T013) run in parallel around T006/T012.
- All story test tasks marked [P] run in parallel (per story).
- US2 flows can use T030 (server flow), T031 (BYOK), T032 (persistence), T034 (stream mapping), T035 (proxy), T036 (UI) — T031/T034 parallel after T030 core is in place.
- US3 and US4 can be worked concurrently after US2 core lands.

---

## Parallel Example: User Story 2

```bash
# Launch tests together:
Task: "Test request routed through Orchestrator to Content Agent and streams"
Task: "Test first token within 2 s under normal load"
Task: "Test streamed content is persisted incrementally"
Task: "Test invalid/expired BYOK fails cleanly"
Task: "Test exactly one invocation + one terminal audit row"
Task: "Frontend SSE client test"

# Launch independent implementation together:
Task: "BYOK resolution in models.py/gate.py"
Task: "SSE event mapping in stream.py"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (sign-up + tenant linkage + auth gate).
4. **STOP and VALIDATE**: US1 independently testable with no generation run.
5. Complete Phase 4: User Story 2 (streaming generation) — the core value.
6. **STOP and VALIDATE**: US1+US2 = the demoable MVP vertical slice (sign-up → 3 free streams).
7. Add US3 (exhaustion/upgrade) and US4 (interruption/lease), then Phase 7 polish + quickstart AC1–AC7 pass.

### Note

- Endpoints/AC labels: AC1→US1, AC2→US3, AC3→US2, AC4→US4, AC5→US2, AC6→US4, AC7→US2 (quickstart mapping), all seven re-verified in T046.
- Auth blocker from the draft context is RESOLVED (Better Auth RATIFIED 2026-09-19; research.md §1 RATIFIED note).
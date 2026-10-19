# Implementation Plan: Free-Tier Real-Time Content Generation

**Branch**: `001-free-tier-content-generation` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-free-tier-content-generation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

A signed-in end-customer can prompt the Content Agent to write book content
that streams token-by-token into the UI, with exactly 3 free generations per
account (atomic, race-safe), single-in-flight enforcement with a self-expiring
lock, incremental persistence so interruptions never lose work, and audit +
capability records written in the same transaction as each content write.
The network-facing generation path lives in the Next.js app (auth + session →
`tenant_id`/`account_id`), which proxies a token stream from an ADK-served
Orchestrator over SSE; the Orchestrator composes the Content Agent, resolves
BYOK credentials, and performs the free-tier/lock/persistence/audit logic
against the Postgres system of record. Hosting remains TBD (Constitution
Article II.9) — this plan keeps deployment concerns isolated.

## Technical Context

**Language/Version**: Python 3.12 for both agent services (uv); TypeScript +
Next.js 15 (App Router) for the frontend.

**Primary Dependencies**: `google-adk` (pinned), `mcp` (pinned, only where an
MCP tool is added), Postgres/pgvector client (pinned), Lago client (pinned;
used only for the upgrade-trigger call), ADK's LiteLLM integration for
non-Gemini BYOK providers. **Auth: Better Auth — RATIFIED by project owner
2026-09-19** for Task 1 (self-hosted, DB-backed; see research.md §1); it lives
behind a `lib/auth` seam, keeping the rest of the slice vendor-neutral. No
agent ever gets a general run-arbitrary-code/SQL tool; DB access in the Python
services is orchestration code, not an agent tool.

**Storage**: Postgres + pgvector (system of record, per Constitution Article V).
Tables touched this slice: `tenants`, `accounts`, `books`, `content_versions`,
`conversations`, `run_states`, `capability_invocations`, `audit_log`,
`model_credentials`, `rate_limit_counts`. Every tenant-data table carries
`tenant_id`.

**Testing**: Python — `pytest`, `pyright`, `ruff` (per AGENTS.md §5).
Frontend — `Vitest`, `ESLint`, `Prettier`. Failure paths (declined BYOK,
provider error, budget-cap/limit hit, in-flight rejection) get automated
tests, not just happy paths (Constitution Article X).

**Target Platform**: Hosting **TBD** (Constitution Article II.9) — do not build
against a hosting target. Design assumes a standard self-hosted Node (Next.js)
and Python (agent services) runtime where SSE is not intermediately buffered;
buffering awareness is a tracked Build risk (research.md).

> **Note, 2026-10-19:** the frontend half of this is now resolved — the Next.js
> app deploys to Vercel with Root Directory = `frontend` (Constitution Article
> II.9, AGENTS.md §2). The Python agent-hosting target this note is really about
> remains TBD, and the SSE-buffering risk above still applies to it.

**Project Type**: Web application — Next.js frontend (Option 2) plus two
Python `uv` service projects for the agent layer.

**Performance Goals**: first streamed token visible ≤ 2 s after request start
under normal load (FR-004/SC-002); no acceptance test may depend on the
unquantified "normal load" clause beyond a normalized-load local check.

**Constraints**: ≤ 3 free generations per account, atomic check-and-increment
(FR-007); single in-flight generation per account with self-expiring lock
(FR-009); one `capability_invocations` + one `audit_log` row per generation in
the same transaction as the content write (FR-006); every record `tenant_id`-
scoped and derived from the authenticated session, never from model text
(Article IV.5); no silent BYOK→free-tier fallback (FR-008); per-device/IP
rate-limit values config-driven (read from config at runtime), enforced
atomically before admission, tuned later (Clarification Q4; FR-002).

**Scale/Scope**: MVP single vertical slice — single dev tenant seeded, modest
account population (hundreds), one generation at a time per account. No resume,
no queue, no publishing/ads/voice/cover/billing-UI work in this slice.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Gate | Result |
|---------|------|--------|
| II.4 Model access (Gemini default via ADK; BYOK first-class) | Agent services use ADK model abstraction with per-task model/temp/param config; BYOK key substituted per request | PASS |
| II.6 Frontend (Next.js 15 App Router) | Frontend is Next.js 15 App Router | PASS |
| II.7 Billing (Lago; not a payment processor) | Only the upgrade-prompt trigger calls Lago; checkout flow is a separate slice | PASS |
| II.8 Free tier (3 generations; rate limit by account/device/IP/tenant) | 3-gen cap enforced atomically; device/IP limits config-driven within tenant (Clarification Q4) | PASS |
| II.9 Hosting (split; frontend ratified 2026-10-19) | Frontend → Vercel (Root Directory = `frontend`); Python agent-hosting target still TBD and not built against; SSE/hosting buffering tracked as a risk | PASS |
| IV.3 No arbitrary code/SQL tools | Data-access is orchestration code; agent tools narrow and named only | PASS |
| IV.5 Tenant isolation | `tenant_id` derived from Next.js session at the boundary; never accepted from model output | PASS |
| VI.4 Small, checkable, committed steps | Task sequence (below) has per-task checks mapped to ACs; one commit per task | PASS |
| VII.1–2 Model-agnostic, BYOK over HTTPS | ADK abstraction; LiteLLM path for Anthropic/OpenAI; no MCP sampling | PASS |
| VIII Auditability | Audit + invocation rows written in the same transaction as content writes | PASS |
| IX Toolchain discipline | `uv` projects (`pyproject.toml` + `uv.lock` committed); sensitive deps pinned; secrets only in `.env` | PASS |
| X Testing | AC1–AC7 become automated tests (`pytest`/`Vitest`); failure cases tested | PASS |
| XI When silent (TBD/uncovered) | Auth vendor surfaced and RATIFIED by the human 2026-09-19 (Better Auth); no remaining uncovered build decisions | PASS |

**Gate result: PASS.** No unjustified violations — Complexity Tracking is not
needed. The one uncovered decision (auth vendor) was surfaced to the human
and RATIFIED (Better Auth) before the build sequence begins.

## Project Structure

### Documentation (this feature)

```text
specs/001-free-tier-content-generation/
├── spec.md              # Feature specification + Clarifications
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/                          # Next.js 15 (App Router) — auth + SSE proxy + UI
├── app/
│   ├── (auth)/signup/
│   ├── (auth)/signin/
│   ├── app/generate/              # streaming UI (client component reading SSE)
│   ├── api/generate/route.ts      # POST → SSE (auth gate, proxy to Orchestrator)
│   ├── api/generation/[id]/route.ts  # GET saved content (AC4 re-fetch)
│   └── api/account/route.ts       # GET allowance + in-flight status
├── lib/                           # auth/session, tenancy derivation, server helpers
├── components/                    # generation/composer/stream/countdown UI
└── tests/                         # Vitest

agents/orchestrator/               # uv project — src/orchestrator/
├── pyproject.toml                 # pinned google-adk, pgclient, liteLLM, lagolib
├── uv.lock
└── src/orchestrator/
    ├── agent.py                   # ADK Orchestrator; composes Content Agent sub-agent
    ├── server.py                  # internal streaming endpoint (FastAPI/uvicorn)
    ├── gate.py                    # atomic credit check, in-flight lease, eligibility
    ├── persistence.py             # incremental content_versions + audit/invocation txn
    └── models.py

agents/content-agent/              # uv project — src/content_agent/
├── pyproject.toml                 # pinned google-adk
├── uv.lock
└── src/content_agent/
    └── agent.py                   # ADK Content Agent (narrow tools only)
                                    # orchestrator depends on it via path dependency

db/
└── migrations/                    # schema for the tables this slice touches
```

**Structure Decision**: Web application (Option 2) extended with the AGENTS.md
agent convention: one `uv` project per agent under `agents/` (`orchestrator`
and `content-agent`), with the Orchestrator project consuming the Content
Agent project by path dependency so ADK multi-agent composition stays
in-process for this slice while the two remain independently deployable later.
The generation *endpoint* and all enforcement live in one place
(frontend route handler + Orchestrator gate), keeping the Content Agent
unreachable from any client (FR-003).

## Build Sequence (Task Plan → `tasks.md`)

Each task ends in a commit and a check against its AC before the next task
starts (Constitution Article VI.4):

1. **Auth + account scaffolding** — Better Auth integration (ratified 2026-09-19), `accounts`/`tenants` schema, first-sign-in
   row linked to the tenant the customer arrived through. Check: signed-out
   request to any protected route → 401, no rows (AC1, partial).
2. **Atomic admissions — free-tier counter + device/IP rate limits** — single
   atomic `UPDATE … WHERE free_tier_count < limit RETURNING …` for the
   per-account cap (FR-007) and the atomic `rate_limit_counts` check-and-
   increment for device/IP limits (FR-002), both before any model call and
   before the in-flight lease; credit-refund path for provider failures
   (Clarification Q1); rate-limit thresholds read from config (T014). Check:
   ≥4 rapid concurrent attempts never exceed 3 successes, counter reads 3 (AC2,
   partial; test written first); concurrent device/IP burst never overshoots
   the config threshold, over-limit requests get `429 rate_limited` pre-stream
   (test written first, T015).
3. **Orchestrator → Content Agent wiring (ADK)** — orchestration receives
   eligible request, routes to Content Agent, model call via ADK abstraction
   (Gemini default); system prompt is the ratified
   `contracts/orchestrator-prompt.md`. Check: valid request produces streamed
   tokens end-to-end in a local test.
4. **BYOK path + failure handling** — `model_credentials` lookup, per-request
   credential substitution, invalid/expired → clear error, credit refunded,
   no fallback (FR-008, Clarification Q1). Check: AC7.
5. **SSE streaming to the client** — route handler returns `Response(stream)`
   immediately (Node runtime, buffering-hostile headers), Orchestrator stream
   proxied; client renders live. Check: first token ≤ 2 s under normalized
   load (AC3).
6. **Incremental persistence** — `content_versions` appended per chunk or
   short interval, `is_partial` flipped at completion. Check: mid-stream
   refresh retrieves exactly what was on screen (AC4).
7. **Single-in-flight guard** — `run_states` lease row, renewed per chunk,
   self-expliring (Clarification Q2); second request → clear rejection. Check:
   AC6.
8. **Audit + capability logging** — content write + `capability_invocations`
   + `audit_log` in one transaction. Check: AC5 (exactly one row each,
   correct `tenant_id`).
9. **Free-tier exhaustion + upgrade trigger** — 4th attempt blocked before any
   model call; UI shows upgrade prompt; Lago checkout-entry call. Check:
   AC2/AC3-style full pass — no invocation/audit row for the blocked attempt.
10. **End-to-end AC1–AC7 pass** — full automated + manual (SSE timing) pass.

## Explicitly Deferred

- Resume-on-reconnect (spec Assumption) — not built; restart-from-prompt only.
- Any queue; anything beyond the single in-flight guard.
- Cover design, formatting, publishing, ads, voice, full billing UI.
- Lago checkout flow (only the trigger is in scope this slice).
- Device/IP rate-limit numeric tuning (config-driven; Clarification Q4).

## Risks to watch during Build

- **SSE buffering** — intermediaries (compression middleware, nginx
  `proxy_buffering`, reverse proxies, some hosting runtimes) can buffer the
  stream so all tokens arrive at once; must return `Response(stream)` with
  `Connection: keep-alive`, `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no`, `runtime='nodejs'`, `dynamic='force-dynamic'`
  (research.md). Test streaming through the eventual hosting target before
  relying on it.
- **Middleware-only auth is insufficient** — CVE-2025-29927 class: auth
  checks must also run in the route handler (Data Access Layer), not only
  middleware, for FR-001 to hold.
- **Atomic free-tier check** — the one place a subtle bug silently gives away
  free usage; its test is written first (Task 2), not last.
- **Network-drop vs deliberate stop** — server can't distinguish them, which
  drives the "connection loss consumes credit" rule (Clarification Q1).
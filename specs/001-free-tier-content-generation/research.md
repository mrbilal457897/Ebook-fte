# Research: Free-Tier Real-Time Content Generation

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-19
**Status**: Complete — all plan-time unknowns below are resolved or explicitly gated.

Research targets came from the Technical Context of [plan.md](plan.md): the
auth stack, the SSE transport across Next.js and the ADK services, ADK
streaming mechanics, BYOK credential handling, and the atomic/lease patterns
for the free-tier counter and in-flight lock.

---

## 1. Auth vendor for sign-up/sign-in (email + OAuth)

- **Decision:** Use **Better Auth** (self-hosted, open-source, TypeScript),
  database-backed (sessions + users in our Postgres system of record),
  with the **engine**, not the UI, integrated. It is the actively maintained
  successor of Auth.js/NextAuth for Next.js App Router. Auth boundary stays
  pluggable behind a narrow service seam (`lib/auth`) so nothing else in the
  slice depends on the vendor.
  **Status: RATIFIED by project owner 2026-09-19 — Task 1 can start.**
- **Rationale:** The accounts table is the source of truth for tenant data
  (Constitution Article V); a self-hosted library keeps user identity and
  our `accounts` row in the same Postgres, unlike hosted SaaS auth that
  holds its own user database and adds a third-party dependency/DPA. Open
  source matches the project's self-hosting posture; Better Auth supports
  email/password + OAuth providers and DB sessions out of the box.
- **Alternatives considered:**
  - *Auth.js/NextAuth v5* — still viable; the project has officially folded
    into Better Auth, so Better Auth is the forward-looking pick.
  - *Clerk* — best-in-class App Router DX (native RSC helpers, `auth()`,
    `clerkMiddleware()`), but hosted SaaS: foreign user DB, pricing, and a
    data-sovereignty surface we don't need for a multi-tenant "system of
    record" design.
  - *Auth0 / Supabase Auth* — heavier enterprise or external-authBaaS
    footprint; not needed for this slice.
- **Status:** RATIFIED by the project owner 2026-09-19 (Constitution
  Article XI confirmation gate). Build Task 1 implements this choice inside
  the `lib/auth` seam; the seam keeps the rest of the slice vendor-neutral.
- **Security note (authoritative):** Next.js middleware is bypassable
  (CVE-2025-29927 class). Enforce sign-in **in the route handler / Data
  Access Layer**, not middleware only — this is what makes FR-001 hold
  server-side.

## 2. SSE transport: frontend → Orchestrator

- **Decision:** The Next.js app owns the network-facing generation endpoint
  and proxies a token stream from the ADK Orchestrator to the client over
  SSE. Client → Next.js route handler → Orchestrator (internal) → Content
  Agent. Browser `EventSource` is **not** used because it only supports GET
  without a body; the frontend does `fetch(..., { method: 'POST' })` and
  parses the SSE-formatted body through a `ReadableStream` reader.
- **Rationale:** One authenticated boundary (FR-001) with `tenant_id`/`account_id`
  derived from the session and forwarded to the internal Orchestrator endpoint
  with a short-lived internal token — never from model text (Article IV.5).
  SSR/SSE streaming is a documented Next.js App Router pattern.
- **Required response discipline (from research):** return `new
  Response(stream)` **immediately** (never drain the stream before returning),
  set `export const runtime = 'nodejs'`, `export const dynamic =
  'force-dynamic'`, and headers `Content-Type: text/event-stream`,
  `Connection: keep-alive`, `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no`. Intermediaries that buffer (compression
  middleware, nginx `proxy_buffering`, some hosting runtimes) defeat
  token-by-token delivery and must be tested against the eventual hosting
  target (still TBD, Article II.9).
- **Alternatives considered:** browser `EventSource` (GET-only, no body —
  rejected); client talking directly to the Orchestrator (loses the single
  auth boundary — rejected).

## 3. ADK streaming mechanics (Python)

- **Decision:** The Orchestrator runs the agent via ADK's async runner and
  streams **events**; text deltas are read from events where `event.partial`
  is `True` (`event.content.parts[].text`), and each delta is emitted as an
  SSE `token` event. Completion/error is signaled by the terminal event.
- **Rationale:** ADK events are the documented unit of streamed output and
  distinguish partial chunks from complete turns, which maps 1:1 onto the
  SSE wire contract (contracts/generation-api.md) and onto incremental
  persistence (FR-005).
- **Detail to verify at Build time:** exact `Event` field names for partial
  text and the `LLM_Chunk`/`LLM_Complete` event kinds on the installed ADK
  version (docs evolve across releases; `google-adk` is pinned so the pinned
  docs/version pair is referenced in `tasks.md`).

## 4. Atomic free-tier counter + refund

- **Decision:** One atomic statement per admission: an eligible account's
  `free_tier_count` is incremented with `UPDATE accounts SET free_tier_count
  = free_tier_count + 1 WHERE id = :acct AND tenant_id = :tenant AND
  free_tier_count < :limit RETURNING free_tier_count` (row-level lock). The
  spec's race case (two near-simultaneous requests for the last credit)
  therefore cannot double-spend: exactly one `RETURNING` succeeds.
- **Rationale:** Non-blocking under concurrency, no read-then-write window, no
  advisory lock needed at this scale. Matches clarification Q1 semantics:
  credit consumed at admission; **refunded** (decrement) only when the
  failure is attributable to the model/provider (invalid/expired credential,
  provider-side error). Never refunded on connection drop.
- **Alternatives considered:** read-then-write (race — rejected); `SELECT …
  FOR UPDATE` on `accounts` (correct but serializes and requires a longer
  txn — rejected for admission path); advisory locks (overkill here; the
  in-flight lease in `run_states` is the mechanism that prevents cross-request
  races on the same account anyway).

## 5. Single-in-flight lock with self-expiry

- **Decision:** A `run_states` row of kind `generation` per account acts as a
  lease: acquired atomically (`INSERT … ON CONFLICT DO NOTHING` /
  equivalent guarded insert) with `lock_expires_at = now() + window`;
  renewed (bump `lock_expires_at`) on each streamed chunk; a request whose
  lease is present and unexpired is rejected with "generation already in
  progress" (FR-009); an expired lease is treated as free (clarification Q2).
- **Rationale:** A dead worker can never permanently block an account because
  the lease self-expires even with no terminal event observed. Lease renewal
  per chunk bounds the lock lifetime to actual generation activity.
- **Alternatives considered:** release-only-on-terminal-event (a crashed
  worker locks the account forever — rejected); fixed window with no renewal
  (long generations would trip a false "in progress"/stale window — rejected;
  renewal keeps the honesty at the chunk cadence).

## 6. BYOK credential handling (ADK + LiteLLM)

- **Decision:** `model_credentials` stores provider + encrypted key
  (KMS/age-encrypted at rest, only decrypted in-memory for the duration of a
  request). The Orchestrator resolves `accounts.active_byok_credential_id`
  and configures the ADK model per request: Gemini BYOK uses the customer's
  Gemini key; Anthropic/OpenAI BYOK goes through ADK's LiteLLM integration.
  On any auth failure from the provider: fail with a clear `byok_invalid` /
  `provider_error` error, refund the credit (clarification Q1), and **never**
  fall back to platform free-tier credit or a platform key (FR-008).
- **Rationale:** Constitution Article VII.2 mandates HTTPS BYOK, not MCP
  sampling; the failure rule is a spec requirement (FR-008), and the refusal
  to fall back protects both the free-tier budget and the customer's intent.
- **Alternatives considered:** silent platform-key fallback (explicitly
  forbidden by FR-008 — rejected); MCP `sampling` BYOK (constitutional
  standing decision says HTTPS-first — rejected for this slice).

## 7. Enforcement boundary (BFF + Orchestrator gate)

- **Decision:** Split enforcement as follows:
  - **Next.js route handler:** session check (FR-001/AC1), session→tenant/account
    derivation, forwarding to the Orchestrator with an internal short-lived
    token, SSE proxying, saved-content re-fetch endpoints.
  - **Orchestrator (Python):** atomic credit check (FR-007), in-flight lease
    (FR-009), BYOK resolution (FR-008), Content Agent routing (FR-003),
    incremental persistence + audit/invocation transaction (FR-005/FR-006).
  - DB access is **orchestration code**, never an agent tool (no arbitrary
    SQL/exec, Article IV.3).
- **Rationale:** The draft's Task 3 already places eligibility checks on the
  Orchestrator; keeping content writes and audit rows in the task boundary
  nearest the agent keeps FR-006's "same transaction" simple, while the auth
  gate stays in the app that owns the session. The Content Agent is never
  reachable from the client (FR-003).
- **Alternatives considered:** all enforcement in Next.js and a thin ADK model
  proxy (keeps DB writes in one service but fights the draft's Orchestrator-
  checks eligibility intent and spreads audit logic away from the agent —
  rejected); all enforcement in the ADK service with Next.js as a pure proxy
  (loses the crisp 401 boundary at the network edge — rejected).

## 8. Rate limiting (device/IP) scope

- **Decision:** Implement FR-002's per-account cap as the acceptance-tested
  enforcement. Device/IP limits are enforced but **config-driven** (thresholds
  in config, tuned during plan/build), as ratified in Clarification Q4 —
  no fixed numeric acceptance criteria this slice.
- **Rationale:** Device identity (cookie/fingerprint) and IP are weak,
  spoofable signals; baking premature numbers into ACs would enshrine tuning
  guesses. The 3-per-account cap + single-in-flight already bound the abuse
  that matters for a first slice.
- **Alternatives considered:** fixed device/IP numbers with ACs now (premature
  — rejected); defer entirely (drops a constitutional requirement — rejected).

## 9. Lago upgrade trigger

- **Decision:** The exhaustion response returns an upgrade signal; the
  frontend calls the (separate-slice) Lago checkout entry — this slice only
  wires the trigger, per spec FR-011 and the billing boundary assumption. The
  expected Lago call shape is pinned at the trigger task using the pinned
  Lago client, without building the checkout flow.
- **Rationale:** Strictly honors the spec's out-of-scope boundary; keeps the
  trigger testable as a stub/contract rather than a real checkout.
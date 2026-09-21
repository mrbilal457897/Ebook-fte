# Feature Specification: Free-Tier Real-Time Content Generation

**Feature Branch**: `001-free-tier-content-generation`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Slice 1: sign-up, free-tier (3 generations), real-time book content generation streamed into the UI token-by-token, with interruption safety and single-active-generation enforcement."

## User Scenarios & Testing *(mandatory)*

The first vertical slice of the E-book Digital FTE: an end-customer signs in
through a subscribing company (tenant), gets 3 free AI generations, and prompts
the Content Agent to write book content that streams into the UI in real time
as it is generated. Everything else (cover design, formatting, publishing, ads,
voice, full billing UI) is out of scope.

## Clarifications

### Session 2026-09-19

- Q: When a generation is interrupted or fails partway through, should a free-tier credit still be consumed? → A: Credit is consumed on start; returned only on a model/provider-side failure; a user refresh, close, or network drop still counts.
- Q: If a running generation dies without completing, how should the single-active-generation lock be released? → A: The lock self-expires after a bounded time window, renewed only while the stream is actively producing; a dead generation can never permanently block the account.
- Q: Should an end-customer's account be reusable across several tenants? → A: One account per tenant; a person signs up separately for each company, email is unique within a tenant, and the session's tenant is the account's tenant.
- Q: Should this slice fix concrete per-device and per-IP generation limits now? → A: FR-002 stays, but device/IP limit values are configuration-driven and tuned during planning; this slice's acceptance tests target the per-account cap exactly, and the device/IP limits are enforced this slice (config-driven thresholds) with a concurrency test of their own — only their numeric tuning is deferred.

### User Story 1 - Sign-Up and Tenant Linkage (Priority: P1)

A new end-customer arrives through a subscribing company's entry point and
signs up with an email address or an OAuth account. An account is created,
linked to the tenant they arrived through, and enabled for exactly 3 free AI
generations. Signing in is the gate for everything else in this slice.

**Why this priority**: Sign-in before any AI usage is a constitutional
requirement, and no generation in this slice works without an account scoped
to a tenant. Every other story depends on it.

**Independent Test**: A brand-new visitor signs up through a tenant entry
point; the account is bound to the correct tenant with a 3-generation allowance.
Fully demonstrable with no generation run.

**Acceptance Scenarios**:

1. **Given** a visitor who arrived through a tenant's entry point and has no account, **When** they sign up by email or OAuth, **Then** an account is created, linked to that tenant, and eligible for exactly 3 free generations.
2. **Given** a signed-in customer on their first visit, **When** they open the generate screen, **Then** their remaining free-tier allowance is shown as 3.
3. **Given** a signed-in customer, **When** a generation request is attempted directly while signed out, **Then** it is rejected with a clear "sign-in required" response and nothing is stored or audited.

---

### User Story 2 - First Real-Time Generation (Priority: P1)

A signed-in customer enters a book idea/prompt and submits it. The request is
routed through the Orchestrator to the Content Agent — never directly to the
agent — and the generated text streams into the UI token-by-token, so the
customer watches their book being written. Every token that is shown is saved
incrementally, so nothing produced so far is ever lost.

**Why this priority**: Streaming generation is the core value proposition of
this slice — it is the reason the customer is here.

**Independent Test**: A signed-in customer (free tier or working BYOK) submits
a prompt and watches a full book draft stream into the UI in real time, with
the streamed content persisted behind the scenes.

**Acceptance Scenarios**:

1. **Given** a signed-in customer with free-tier credit remaining, **When** they submit a book prompt, **Then** the request is routed via the Orchestrator to the Content Agent and content streams into the UI token-by-token.
2. **Given** a submitted generation under normal load, **When** the first tokens are produced, **Then** they appear in the UI within 2 seconds of the request start.
3. **Given** a running generation stream, **When** a chunk of content is produced, **Then** it is saved so the content visible in the UI and the content stored never diverge.

---

### User Story 3 - Free-Tier Exhaustion and Upgrade Prompt (Priority: P2)

After 3 generations, a 4th attempt is blocked before any model call is made.
The counter never goes past 3 — not even when two near-simultaneous requests
race for the last credit — and the customer sees an upgrade prompt that opens
the subscription flow entry point.

**Why this priority**: The 3-generation cap is a ratified, commercial decision;
enforcing it exactly is what keeps the free tier safe while still converting
customers at the exhaustion point.

**Independent Test**: Four generation attempts by one account. Exactly 3
succeed, the 4th is blocked with no model work, the counter reads 3, and an
upgrade prompt appears.

**Acceptance Scenarios**:

1. **Given** an account that has used 3 generations, **When** a 4th generation is requested, **Then** it is rejected before any model call and an upgrade prompt is shown.
2. **Given** an account with 1 free credit left, **When** two generation requests arrive at nearly the same time, **Then** exactly one succeeds, the counter reads 3, and the other is blocked.

---

### User Story 4 - Interruption Resilience and Single-Active-Generation (Priority: P2)

Closing or refreshing the browser mid-generation never loses content already
generated — the customer can come back and retrieve what was written so far.
Only one generation may be in flight per account at a time; a second attempt
(from any device) is rejected with a clear "already in progress" message,
never queued silently, never run in parallel.

**Why this priority**: Mid-stream interruptions are the most common way a
first-time session dies. Protecting already-generated work is what turns a
scary failure into a minor inconvenience; the single-generation guard protects
the product from runaway cost.

**Independent Test**: Start a generation, refresh mid-stream, and confirm the
saved content survives; then, while a generation is in flight, confirm a second
request from the same account is rejected.

**Acceptance Scenarios**:

1. **Given** a generation in progress, **When** the customer refreshes or closes the browser, **Then** all content streamed up to that point is saved and retrievable afterwards.
2. **Given** a generation already in progress for an account, **When** a second generation request arrives from the same account (any device), **Then** it is rejected with a clear "generation already in progress" response.
3. **Given** a stream that dropped, **When** the customer re-submits the same prompt, **Then** a fresh generation starts from scratch (no resume is supported in this slice).

---

### Edge Cases

- **Network drop mid-stream**: the client detects the dropped connection and
  shows a "generation stopped" state; the customer restarts generation from
  the same prompt (fresh start, no resume — see Assumptions). The credit
  already consumed at start is not returned, because a drop is
  indistinguishable from a deliberate stop from the server's perspective.
- **Simultaneous devices**: covered by the single-active-generation rule —
  the second device is told a generation is already running, not allowed to
  start a parallel one.
- **Invalid/expired BYOK key**: the request fails with a clear error; no
  fallback to platform free-tier credit, and no free-tier count is consumed.
- **Free-tier counter race**: the eligibility check and counter increment are
  atomic, so two near-simultaneous requests cannot both slip through as the
  last allowed generation.
- **First-token latency under load**: the 2-second target is under normal
  load; if the first token is slow, the UI shows a "still working" state
  rather than a failure.
- **Mid-generation provider-side error**: content streamed up to the error
  remains saved and retrievable; the customer is told the generation stopped,
  and the consumed credit is returned so a retry does not burn the allowance.
- **Stale in-flight lock**: if a generation dies silently (server crash, long
  timeout, lost connection), the single-active-generation lock self-expires
  after a bounded time window; once expired, a new generation is allowed even
  though no terminal event was ever observed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST reject any generation request from a signed-out user
  with a clear "sign-in required" response, enforced server-side, and MUST NOT
  execute any AI generation work, create content records, or leave audit
  activity for such a request.
- **FR-002**: System MUST track a free-tier count per account, and MUST apply
  rate limiting per device and per IP, scoped within the account's tenant. The
  device/IP check-and-increment is a single atomic statement keyed by (tenant,
  account, kind, window) with thresholds read from configuration at runtime —
  never hardcoded — so a device or IP that has reached its limit is rejected
  even when several requests arrive concurrently. A request over its device or
  IP limit MUST be rejected before any model call, MUST NOT consume free-tier
  credit or platform credit, and MUST NOT create content, invocation, or
  terminal audit rows (a `rate_limit.blocked` audit entry is the only
  permitted record). Device/IP numeric thresholds are tuned during planning;
  this slice acceptance-tests the atomic enforcement (concurrency) and reads
  the values from config.
- **FR-003**: System MUST route every generation request through the
  Orchestrator to the Content Agent; the Content Agent MUST NOT receive a
  generation request directly from the client.
- **FR-004**: System MUST stream generation output to the UI token-by-token,
  with the first token visible within 2 seconds of request start under normal
  load.
- **FR-005**: System MUST persist generated content incrementally during
  generation (per chunk or on a short interval), not only when generation
  completes.
- **FR-006**: System MUST write exactly one capability-invocation record and
  exactly one audit record — both tied to the account's tenant — in the same
  transaction as each content write.
- **FR-007**: System MUST block the 4th generation attempt before any model
  call is made, with the eligibility check and counter increment atomic
  (never exceeding 3, never bypassed by retrying).
- **FR-008**: System MUST make any request using an invalid, expired, or
  failing customer model credential fail with a clear error, MUST NOT fall
  back to platform free-tier credit, and MUST NOT consume the account's
  free-tier count or platform credit on that failure.
- **FR-009**: System MUST allow at most one generation in flight per account
  at a time; a second request while one is active MUST be rejected with a
  clear "generation already in progress" response — never queued silently,
  never run concurrently. The in-flight lock MUST self-expire after a bounded
  time window (renewed only while the stream is actively producing), so a
  silently dead generation can never permanently block the account.
- **FR-010**: System MUST support sign-up by email or OAuth; a new account
  MUST belong to exactly one tenant — the tenant the customer arrived through
  — with email unique within a tenant, and MUST start with exactly 3
  free-generations allowance.
- **FR-011**: System MUST show, at the exhaustion point, an upgrade prompt
  that initiates the subscription flow entry point (the checkout flow itself
  is a separate slice).

### Key Entities *(include if feature involves data)*

- **Account**: An end-customer; belongs to exactly one tenant; holds sign-in
  identity, tenant linkage, the free-tier counter, and rate-limit state for
  this slice.
- **Tenant**: The subscribing company the customer belongs to; every account,
  content, and audit record in this slice is scoped to it.
- **Content Version**: The book content produced by one generation; grows
  incrementally during streaming and is retrievable at any point mid-stream.
- **Conversation**: The session in which generations happen; carries prompt
  history and session state.
- **Audit Record**: One row per generation action — what happened, when, who
  (account and agent), and which tenant.
- **Capability Invocation Record**: One row per tool/agent invocation —
  latency, cost, success/failure, and which tenant.
- **Model Credential**: The customer's own model-provider key (BYOK) used to
  run generations; an invalid or expired credential triggers FR-008 behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A brand-new visitor can sign up and submit their first
  generation within 3 minutes of their first visit.
- **SC-002**: Under normal load, the first streamed words of the book appear
  in the UI within 2 seconds of pressing generate.
- **SC-003**: Free-tier enforcement is exact: an account can run at most 3
  generations, every 4th attempt is blocked before any model work, and the
  counter never exceeds 3 even under rapid concurrent attempts.
- **SC-004**: 100% of signed-out generation attempts are rejected and produce
  no stored content, no invocation record, and no audit record.
- **SC-005**: Every completed generation leaves exactly one audit record and
  one capability-invocation record, both tied to the customer's tenant.
- **SC-006**: For every interrupted generation, 100% of the content the
  customer saw before the interruption is still retrievable afterwards.
- **SC-007**: While one generation is running for an account, 100% of further
  generation attempts from that account are rejected — never parallel, never
  silently queued.
- **SC-008**: A customer whose model key is invalid or expired receives a
  clear failure, loses no free-tier credit, and spends no platform credit.

## Assumptions

- **No resume-on-reconnect (documented MVP limit)**: a dropped stream requires
  the customer to restart generation from the same prompt. Resume needs
  durable, replayable generation state beyond a first vertical slice; simple
  restart ships faster and is honest about being an MVP limit.
- **Single active generation per account, not a queue**: a queue adds job
  state and position-in-queue UI this slice does not need; a clear
  "already in progress" error is enough for the MVP. The in-flight lock is
  bounded in time by an automatic self-expiry, so a dead generation can never
  lock the account out (see FR-009).
- **Credit consumption timing**: a free-tier credit is consumed atomically when
  a generation is admitted and model work begins. The credit is returned only
  when the failure is attributable to the model/provider — an invalid, expired,
  or failing credential (FR-008) or a mid-stream provider-side error. A user
  refresh, browser close, or network drop still consumes the credit, because
  the server cannot reliably distinguish a deliberate stop from a lost
  connection. This reconciles FR-007's atomicity with FR-008's no-consumption
  rule.
- **Sign-up scope**: sign-up uses standard email/password or OAuth; email
  verification, password recovery, and other sign-up UX details beyond account
  creation and tenant linkage are outside this slice.
- **Identity model**: one account per tenant — a person signs up separately
  for each tenant they use, with email unique within a tenant; there is no
  cross-tenant login or account reuse in this slice (see FR-010).
- **First-token deadline is under normal load**: under exceptional load the
  system shows a "still working" state rather than failing the generation.
- **Platform decisions are constitutional**: the underlying platform choices
  (agents, backing store, streaming, billing engine) are already ratified in
  the Constitution and are restated nowhere in this spec.
- **Billing boundary**: only the upgrade-prompt trigger point is in scope; the
  subscription checkout flow itself is a separate slice.
- **Rate limiting scope**: per-device and per-IP rate limits are enforced
  within the account's tenant, matching the free-tier cap's tenant scoping,
  with their numeric thresholds configurable at runtime and tuned during
  planning; the per-account cap is the hard, acceptance-tested enforcement in
  this slice, and the device/IP limits carry their own atomicity/concurrency
  test (FR-002).
# AGENTS.md — E-book Digital FTE

This file is read by OpenCode (and any AGENTS.md-compliant coding agent) at the
start of every session. It is the project's operating manual — the
**constitution** in Spec-Driven Development terms. Treat it as persistent
guidance the agent must follow, not a suggestion. If a rule here must never be
broken, it is backed by a test/check, not left to the agent's judgment alone.

Whenever this file is ambiguous about something being built right now, **stop
and ask the human before writing code.** Do not guess and proceed on anything
marked TBD or anything not covered here.

---

## 1. Mission

Build an autonomous AI Worker ("E-book FTE") that operates 24/7, multi-tenant,
so that many subscribing companies can each offer their own end-customers a
service that creates, designs, formats, publishes, and markets e-books —
end to end — with minimal human intervention, under human oversight for
irreversible or costly actions.

## 2. Confirmed product decisions (do not re-litigate these without asking)

| Area | Decision |
|---|---|
| Tenancy | Multi-tenant SaaS: many **companies** (tenants) subscribe; each has its own **end-customers** |
| Publishing | **Corrected 2026-10-01 — the previous wording was based on a false premise, see `specs/004-publishing-preflight/research.md`.** KDP, Apple Books, and IngramSpark expose **no public self-publisher submission API**, so there are no "end-customer's own platform credentials" to publish through. Verified: KDP is a web form with no upload API at all (its only API is read-only sales data); Apple Books for Authors is a web portal requiring an iTunes Connect account; IngramSpark is a web portal. Every third-party "KDP automation" is Puppeteer/CDP browser clicking, and Amazon's final Publish control is reported to require a human click regardless. **Therefore: we prepare and validate the package, and hand the human a precise checklist — we do not submit.** Actual submission is deferred; if it is ever built it must be via browser automation (a materially different architecture with ToS exposure, and out of scope until the human approves it) or via a distributor that genuinely has a submission API. Do not build a `submit_for_publishing` tool against these platforms — it would be a tool that cannot do the thing it says |
 |
| Ads | End-customer connects their *own* ad account via OAuth (Meta Ads, Google Ads); their own budget, spend-threshold approval required |
| Model access | Gemini is the default/platform model, via **Google ADK**. BYOK is still required (Principle 5) — a customer may connect their own Gemini, OpenAI, or Anthropic key |
| Agent framework | **Google Agent Development Kit (ADK)**, Python, Apache 2.0 |
| Frontend framework | **Next.js 15+ (App Router)** |
| Billing/subscriptions | **Lago** (open-source, self-hosted billing/metering) for subscription + invoicing logic. Card capture still needs a licensed payment gateway underneath — do not treat Lago as a payment processor |
| Testing/lint | Python: `pytest`, `pyright`, `ruff`. Frontend: `ESLint`, `Prettier`, `Vitest` |
| Hosting/deployment | **TBD** — not yet decided. ADK natively deploys to Cloud Run, GKE, or its managed Agent Runtime; do not pick one and build against it until this is explicitly confirmed. Keep deployment concerns (Dockerfiles, IaC) isolated so the choice can still change cheaply |

## 3. Principles

1. **Spec before code.** Every feature ships with a spec in `specs/`. No
   feature touching more than one file gets built from a one-line
   instruction alone.
2. **Model-agnostic by design.** No feature hard-codes a single AI provider.
   All model calls go through ADK's model abstraction. Model, temperature,
   top_p, max_tokens, and system prompt are configurable per task type, not
   hard-coded. Gemini is the default; ADK's LiteLLM integration is the path
   to Anthropic/OpenAI for BYOK customers.
3. **BYOK first-class, HTTPS by default.** A customer connects their own
   provider API key; our backend calls the provider over HTTPS with that
   key, encrypted at rest, billed to the customer's account. MCP
   `sampling` is a documented future option for MCP-capable hosts only —
   do not build it before the HTTPS path works end to end (most
   browser/mobile MCP clients don't support sampling as of 2026, and this
   product is a web app, not a desktop agent host).
4. **Every Worker runs against a system of record.** No AI action that
   matters (a purchase, a publish, an ad spend, a generated chapter) lives
   only in a chat transcript. Postgres + pgvector is the source of truth
   for business records, the reference library (semantic search), live
   state, and the audit trail. Every table that holds tenant data carries
   a `tenant_id`.
5. **Every action is auditable.** Every tool call, generation, publish, or
   ad-spend action writes an audit row (agent, action, inputs, output,
   timestamp, tenant_id) in the same transaction as the action itself.
6. **Narrow tools over broad ones.** No customer-facing agent ever gets a
   general "run arbitrary code" or "run arbitrary SQL" tool. Each
   capability is a narrow, named ADK tool or a scoped custom MCP server.
   The model never sees a raw database connection, a raw SQL string, or a
   raw credential — only a named function it can call.
7. **Human-in-the-loop for irreversible/costly actions.** Publishing a book
   live, ad spend above a threshold, and refunds require explicit
   customer or admin confirmation (ADK's human-in-the-loop / approval
   pattern). Everything else may run autonomously.
8. **Orchestrator + specialists, not one giant agent.** A top-level
   Orchestrator interprets end-customer intent and routes to specialized
   agents (roster below) using ADK's multi-agent composition. Specialists
   don't talk to the customer except through the Orchestrator's turn.
9. **Free tier is abuse-resistant.** Sign-in is mandatory before any AI
   usage. Free tier is capped (3 generations) and rate-limited per
   account + device + IP, not just per session — and per tenant, since
   this is multi-tenant.
10. **Prefer what exists.** Reuse a vendor MCP server or SDK before
    building a custom one. Build custom only when reuse, scope-narrowing,
    or process isolation genuinely requires it.
11. **Tenant isolation is non-negotiable.** No query, tool, or cache may
    cross tenant boundaries. Every data-access tool takes (or derives)
    `tenant_id` and enforces it — never trust a `tenant_id` the model
    volunteers in its own text; derive it from the authenticated session.

## 4. Specialized agent roster

- **Orchestrator** — intent routing, policy enforcement, session state,
  handoffs between specialists (ADK multi-agent pattern).
- **Content Agent** — book text/chapter generation, editing, tone control.
- **Cover Design Agent** — cover concepts, prompts to image models, variants.
- **Formatting Agent** — sizing/trim, interior layout, EPUB/MOBI/PDF export.
- **Publishing Advisor Agent** — platform-specific rules (KDP, Apple Books,
  IngramSpark, Draft2Digital), metadata, categories, ISBN guidance, and the
  actual submission call (behind the human-approval gate for "go live").
- **Marketing/Ads Agent** — ad copy, targeting suggestions, campaign
  creation via the customer's own connected ad account (spend above
  threshold = human approval).
- **Voice Agent** — text-to-speech audiobook generation, voice selection.
- **Onboarding/Support Chatbot Agent** — answers questions, reduces
  first-use fear, recommends next steps, escalates to human support when
  stuck.

## 5. Toolchain & environment rules

### Python: `uv` only, always
- Every Python service/package (each specialist agent, each custom MCP
  server) is its own `uv` project: `pyproject.toml` + `uv.lock`. Never use
  bare `pip install` or an unmanaged `venv`.
- Scaffold with `uv init --package --python 3.12 <name>` so you get a
  `src/<name>/` layout, not the flat layout. Run everything through
  `uv run ...`, `uv add <pkg>`, `uv sync`. Never hand-edit `uv.lock`.
- **Version-lock, don't float, for anything sensitive.** Pin exact
  versions (`uv add <pkg>==<version>`) for: `google-adk`, the Gemini/model
  SDKs, `mcp`, the pgvector client, Lago's client library, and any
  publishing/ads API client. Ranges (`>=`) are only acceptable for
  low-risk dev tooling (`pytest`, `pyright`, `ruff`).
- Commit `uv.lock`. A dependency bump is its own small change with a
  one-line "why," never bundled silently into a feature commit.
- Before adding a new dependency, check whether an existing one already
  covers the need.

### Frontend (Next.js): pin exact versions for anything UI-critical
- Pin exact versions in `package.json` for GSAP, the streaming client, and
  the ADK-facing API client. Commit the lockfile (`package-lock.json` or
  equivalent).

### Secrets
- Never commit secrets. Platform keys, BYOK keys, publishing-platform
  credentials, ad OAuth tokens, and DB URLs live in `.env` (git-ignored).
  `.env.example` lists every required variable with a placeholder, kept in
  sync whenever a new one is added. The agent never reads the real `.env`
  file's contents back to you or into logs.

---

## 6. Skills — when and how to use them

Skills live in `.claude/skills/` (the one location every tool — OpenCode,
Claude Code, or a Worker's own runtime — can find).

**Write a Skill when:**
- A workflow will be reused across many tasks or sessions (e.g. "format a
  manuscript to KDP trim-size spec," "draft an ad-copy variant set," "run
  the plagiarism/originality check before publish," "onboard a new tenant").
- The steps are domain knowledge worth keeping current in one place instead
  of re-explained in every prompt.

**Don't write a Skill for:**
- A one-off task you'll only do once.
- Something simple enough to just ask for directly.

**How to create one:** use the `skill-creator` skill/tool if available;
otherwise hand-write `SKILL.md` with YAML frontmatter (`name` +
a sharp, non-circular `description`), an imperative body, 1–2 examples,
and known edge cases. Sharpen the description with this check: delete the
obvious keyword — does it still say *when* to fire? If not, it's too narrow.

**Composition rule:** if a workflow has more than 2–3 tightly-coupled steps
and any step might be reused alone (e.g. formatting reused by both the
Formatting Agent and a manual re-export), split it into several small
Skills chained through files in `tmp/`, not one giant Skill.

---

## 7. MCP — when and how to use it

Decision order for any new external capability:

1. **Vendor already ships an MCP server for it?** Use theirs — check
   before building. Verify current status for: the payment/billing stack,
   and any publishing/ads platform that may have added MCP support since
   this was written.
2. **Single function, single agent, no sensitive scope?** Use a plain ADK
   tool (`FunctionTool`) in that agent's own code. Don't build an MCP
   server for it.
3. **Reused across agents, needs a narrow/reviewed scope, or needs to
   outlive one agent's process?** Build a custom MCP server:
   - Stateless streamable HTTP transport by default; stdio only for local
     dev tooling.
   - Exactly the named operations needed — no general "run arbitrary
     query" tool, ever, on anything customer-facing.
   - Destructive/costly operations (publish live, spend ad budget above
     threshold, issue refund) sit behind an explicit ADK approval step.
4. **A management/admin MCP server** (e.g. a database provider's own
   management MCP, used to set up schema during development) is a
   **development-time tool only.** Never wire it into a customer-facing
   runtime agent — that agent gets its own narrow custom MCP server or a
   scoped ADK tool instead.

---

## 8. System of record

Postgres + pgvector, one database, two groups of tables. Every table below
carries `tenant_id`.

**Shared spine** (every Worker needs these):
- `conversations` — session state: who, when, summary
- `documents` + `embeddings` — reference library (policies, past drafts,
  style guides) for semantic search
- `audit_log` — trace of every action the Worker took
- `capability_invocations` — every tool/skill call: latency, cost,
  success/fail
- `run_states` — actions paused, waiting on human approval

**Business-specific:**
- `accounts` — end-customer signup, subscription tier, free-tier counter
- `model_credentials` — BYOK keys (encrypted), provider, default
  generation params (temperature, etc.)
- `books` — a book's record and status (draft/formatting/publishing/live)
- `content_versions` — versioned chapters/drafts (spec is the source of
  truth for behavior; content is the source of truth for the book itself,
  and both are versioned the same way)
- `cover_assets` — generated cover variants, chosen one
- `formatting_jobs` — trim size, target format, status
- `publishing_records` — per-platform status, ISBN, metadata, submission
  timestamps
- `ad_accounts` — connected OAuth tokens per end-customer, per platform
- `ad_campaigns` — platform, budget, spend-so-far, approval status
- `subscriptions` / `invoices` — Lago-backed billing records

---

## 9. Build discipline

- **Plan before code.** Use plan mode (`Tab` in OpenCode) for anything
  beyond a one-line fix. Propose the approach, wait for approval, then
  build.
- **Small, checkable steps.** Implement one step, check it against the
  spec's acceptance criteria, commit, then continue. Every commit is a
  clean rollback point (`git init` at project start; rely on `/undo`).
- **Update the spec first.** If a build step reveals the spec was silent
  on something, update `specs/.../spec.md` before writing the code that
  fills the gap.
- **Design pass every few cycles.** Separately from acceptance-criteria
  checks, periodically ask: which files got touched, is a rule now
  written in two places, do any names no longer describe what they do.
  Read that part of the code yourself.
- **Ask before assuming.** If a task touches anything marked TBD in
  Section 2, or anything this file doesn't cover, stop and ask the human
  rather than picking a default.

---

## 10. Testing & verification

- Every feature's acceptance criteria (from its `spec.md`) become actual
  checks: automated tests where possible (`pytest` / `Vitest`), a short
  manual checklist where not.
- Payment, publishing, and ad-spend paths always get an automated test for
  the failure case (declined card, platform rejection, budget-cap hit),
  not just the happy path.
- `pyright` and `ruff` (Python) / `ESLint` (frontend) run before you read
  generated code yourself — let the tools catch the mechanical errors
  first.

---

## 11. Directory conventions

```
specs/<slice-name>/research.md   # Phase 1 output
specs/<slice-name>/spec.md       # Phase 2 output
specs/<slice-name>/plan.md       # Phase 4 planning output
.claude/skills/<skill-name>/     # Skills, shared across tools
agents/<agent-name>/             # Each ADK agent, its own uv project
mcp-servers/<server-name>/       # Custom MCP servers, one uv project each
frontend/                        # Next.js app
tmp/                             # Skill-to-skill file handoffs (git-ignored)
```
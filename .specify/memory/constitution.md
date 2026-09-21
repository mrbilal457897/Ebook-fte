<!--
SYNC IMPACT REPORT — scratch material for human review; REMOVE BEFORE COMMIT.
=============================================================================
Initial ratification of the E-book Digital FTE Constitution.

Version change: (unratified blank scaffold) -> 1.0.0   [MAJOR — inaugural adoption]
Ratified: 2026-09-18 (from user input)
Last Amended: 2026-09-18 (today)

Modified principles: none — no prior principles existed; every template
placeholder in the scaffold was filled for the first time.

Added sections:
  - Preamble
  - Core Principles (Article I .. Article X as principle entries):
    Article I Mission; Article II Product Scope; Article III Covered Lifecycle;
    Article IV Non-Negotiable Guardrails; Article V System Architecture;
    Article VI Development Method; Article VII Model & Tool Access;
    Article VIII Auditability; Article IX Toolchain Discipline; Article X Testing
  - Article XI — When This Document Is Silent (second template section slot)
  - Governance (holds Article XII — Amendment Process body)

Removed sections: none — the prior file was the unratified default template.

Heading adjustments (content preserved verbatim; levels aligned to the
constitution-template hierarchy H1 > H2 > H3 > H4):
  - Title: "# Constitution — E-book Digital FTE" -> "# E-book Digital FTE
    Constitution" (fills the [PROJECT_NAME] placeholder)
  - Articles I-X re-parented under "## Core Principles" as "###" entries
  - Article V's internal "### Agent roster" / "### System of record" -> "####"
  - "## Article XI — When This Document Is Silent" retained as an H2 section
  - "## Article XII — Amendment Process" folded into the template-fixed
    "## Governance" heading; its body is preserved verbatim.

Follow-up TODOs:
  - None.
  - Non-blocking wording check for a future PATCH clarification: Article
    XII.2 says an amendment "updates the Ratified date" — if the intended
    meaning is the "Last Amended" column of the version footer, that is a
    clarification an amendment could make later.
-->

# E-book Digital FTE Constitution

**Version:** 1.0.0
**Ratified:** 2026-09-18
**Status:** Active

This is the governing document for the E-book Digital FTE project. Every
spec, plan, and line of code produced under Spec-Driven Development for this
project must comply with the Articles below. Where a spec conflicts with
this Constitution, the Constitution wins — the spec must be revised, not the
other way around. This document changes only through the Amendment process
in Article XII.

---

## Preamble

We are building an autonomous AI Worker — the **E-book Digital FTE** — that
operates 24/7 so that subscribing companies can offer their own end-customers
a complete, self-serve path from a blank idea to a published, marketed
e-book: content generation, cover design, formatting, publishing, advertising,
and voice narration — with a human approving only the actions that are
costly or irreversible.

---

## Core Principles

### Article I — Mission

The system shall let an end-customer go from idea to a formatted, published,
and marketed e-book with minimal manual work, while remaining safe,
auditable, and financially accountable to both the platform and the
end-customer at every step.

### Article II — Product Scope (ratified decisions)

These are settled, not open for silent reinterpretation. A spec that needs
to change one of these must say so explicitly and get it re-confirmed.

1. **Tenancy.** The system is multi-tenant SaaS. A **tenant** is a
   subscribing company; each tenant has its own **end-customers**, who are
   the ones actually generating and publishing books.
2. **Publishing.** The system fully auto-publishes to KDP, Apple Books, and
   IngramSpark using the end-customer's own platform credentials. The
   final "go live" action always requires explicit human approval.
3. **Advertising.** The end-customer connects their own ad account (Meta
   Ads, Google Ads) via OAuth and spends their own budget. Spend above a
   configured threshold requires explicit human approval.
4. **Model access.** Gemini, via Google ADK, is the default model layer.
   Bring-Your-Own-Key (BYOK) is a first-class feature: an end-customer may
   connect their own Gemini, OpenAI, or Anthropic key over HTTPS, billed
   to their own account.
5. **Agent framework.** Google Agent Development Kit (ADK), Python.
6. **Frontend.** Next.js 15+ (App Router), with GSAP-driven motion.
7. **Billing.** Lago (open-source, self-hosted) for subscription and
   invoicing logic. Lago is not a payment processor; a licensed gateway
   still sits underneath it for card capture.
8. **Free tier.** Sign-in is mandatory before any AI usage. Free tier is
   capped at 3 generations per account, rate-limited by account, device,
   IP, and tenant.
9. **Hosting.** Not yet decided (TBD). Do not build against a specific
   hosting target until this is explicitly ratified as an amendment.

### Article III — The Covered Lifecycle

The system's specialized agents (Article V) shall together cover the full
e-book lifecycle end to end. No slice of this lifecycle may be silently
dropped from scope without an amendment:

**Content generation → Cover design → Formatting/sizing → Publishing →
Marketing/ads → Voice narration**, with onboarding and support running
alongside all of it.

### Article IV — Non-Negotiable Guardrails

1. No AI-generated content is published without a plagiarism/originality
   and basic copyright-risk check.
2. No customer payment data touches an agent directly — the payment
   provider's hosted fields/SDK only (PCI scope stays off our servers).
3. No customer-facing agent is ever given a general "run arbitrary code"
   or "run arbitrary SQL" tool. Every capability is a narrow, named tool.
4. No admin/management MCP server (e.g. a database provider's own
   management MCP, used only during development) is ever wired into a
   customer-facing runtime agent.
5. No query, tool, or cache may cross tenant boundaries. `tenant_id` is
   always derived from the authenticated session — never trusted from
   model-generated text.
6. Publishing a book live, spending ad budget above threshold, and issuing
   refunds always require explicit human confirmation. No exception.

### Article V — System Architecture

#### Agent roster

- **Orchestrator** — intent routing, policy enforcement, session state,
  handoffs between specialists.
- **Content Agent** — book text/chapter generation, editing, tone control.
- **Cover Design Agent** — cover concepts, prompts to image models, variants.
- **Formatting Agent** — sizing/trim, interior layout, EPUB/MOBI/PDF export.
- **Publishing Advisor Agent** — platform rules, metadata, ISBN guidance,
  and the gated submission itself.
- **Marketing/Ads Agent** — ad copy, targeting, campaign creation via the
  end-customer's own connected ad account.
- **Voice Agent** — text-to-speech audiobook generation, voice selection.
- **Onboarding/Support Chatbot Agent** — reduces first-use fear, answers
  questions, recommends next steps, escalates to human support.

Specialists do not speak to the end-customer except through the
Orchestrator's turn.

#### System of record

Postgres + pgvector is the single source of truth for business records, the
semantic reference library, live state, and the audit trail. Every table
holding tenant data carries `tenant_id`. See `AGENTS.md` §8 for the current
table list; changes to the schema follow normal spec review, not this
Constitution, unless they violate Article IV.5 (tenant isolation).

### Article VI — Development Method

1. **Spec before code.** No feature touching more than one file is built
   from a one-line instruction. It gets a spec in `specs/`.
2. **Research → Specify → Clarify → Build**, in that order, for every
   slice of work. Slices are sized so one loop is reviewable, not the
   whole product at once.
3. **Plan before code within Build.** Use plan mode before implementation
   on anything beyond a trivial fix.
4. **Small, checkable, committed steps.** Each step is checked against its
   spec's acceptance criteria and committed before the next step starts.
5. **The spec is updated before the code that fills a gap it revealed.**
   The spec remains the living source of truth, not a one-time document.

### Article VII — Model & Tool Access

1. **Model-agnostic by design.** No feature hard-codes a single AI
   provider. Model, temperature, top_p, max_tokens, and system prompt are
   configurable per task type.
2. **BYOK is HTTPS-based**, not MCP sampling, until sampling support is
   broadly available in web-facing MCP clients. This is a standing
   technical decision, revisit only via amendment.
3. **MCP decision order:** prefer a vendor's existing MCP server; else a
   plain, narrow function tool for single-agent needs; else a custom,
   scoped MCP server for capabilities reused across agents or needing
   process isolation. Full detail lives in `AGENTS.md` §7.
4. **Skills** are used for reusable, domain-encoded workflows, not one-off
   tasks. Full detail lives in `AGENTS.md` §6.

### Article VIII — Auditability

Every tool call, generation, publish action, and ad-spend action writes an
audit row — agent, action, inputs, output, timestamp, `tenant_id` — in the
same transaction as the action itself. If an action cannot be audited this
way, it is not shipped until it can be.

### Article IX — Toolchain Discipline

1. Every Python service is its own `uv` project (`pyproject.toml` +
   `uv.lock`); no bare `pip`, no unmanaged `venv`.
2. Exact versions are pinned for anything sensitive: the ADK/model SDKs,
   `mcp`, the pgvector client, Lago's client, and any publishing/ads API
   client. Ranges are for low-risk dev tooling only.
3. Frontend UI-critical packages (GSAP, the streaming client) are pinned
   the same way.
4. Secrets never enter version control. `.env` is git-ignored;
   `.env.example` stays in sync.

### Article X — Testing

Every feature's acceptance criteria become actual checks — automated where
possible, a manual checklist where not. Payment, publishing, and ad-spend
paths always get an automated test for their failure case, not just the
happy path, before they are considered done.

---

## Article XI — When This Document Is Silent

If a task touches something this Constitution does not cover, or something
marked TBD in Article II, the agent stops and asks the human. It does not
pick a default and proceed.

---

## Governance

1. A change to Article II (ratified decisions) or Article IV (guardrails)
   requires explicit, in-conversation confirmation from the project owner
   before it takes effect — it cannot be inferred from a spec or from code.
2. Any amendment bumps this document's version (semantic versioning: a
   guardrail or scope change is MAJOR; a new non-breaking rule is MINOR; a
   clarification is PATCH) and updates the Ratified date.
3. `AGENTS.md` is the operational companion to this Constitution — when
   they conflict, this Constitution governs, and `AGENTS.md` is updated to
   match.

**Version**: 1.0.0 | **Ratified**: 2026-09-18 | **Last Amended**: 2026-09-18
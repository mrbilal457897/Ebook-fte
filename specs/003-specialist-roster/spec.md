# Feature Specification: Specialist Roster — Wiring the Wired Agents to Real Data

**Slice**: 003
**Status**: ratified inline by the project owner, 2026-09-29
**Depends on**: slice 001 (`specs/001-free-tier-content-generation/`), slice 002
(`specs/002-ebook-data-mcp/`)
**Prerequisites**: the `ebook-data` MCP server exists and its 8 tools are
verified against real Postgres (slice 002 T001–T016, T101–T104).

## 1. Why this slice exists

AGENTS.md §4 names an eight-agent roster. Until now exactly one of them was
wired: the Content Agent. The other seven existed as `agent.py` + `instructions.py`
scaffolds — a name, a model string, and a system prompt describing tools that
were never built and never attached.

That is a worse state than absence. The ratified Orchestrator prompt
(`specs/001-.../contracts/orchestrator-prompt.md`) routes to all eight by name,
and the 17 skills in `.claude/skills/` describe workflows owned by agents that
cannot run. The prompt's own rule — *"Only agents that exist in the running
system may be routed to… do not pretend to have done so"* — is only satisfiable
by the one wired agent today, which is why the prompt carries a special-case
paragraph ("only the Content Agent is wired up") that will stop being true here.

This slice closes that gap for the specialists whose backing tools actually
exist, and **deliberately does not** wire the ones whose tools do not.

## 2. The eight tools, and who may call them

`ebook-data` exposes 8 tools (slice 002 §2). Principle 6 and AGENTS.md §7.3
require each agent to see only the ones it has business calling, as an explicit
allowlist — a tool added to the server later must not be silently exposed.

| Specialist | Allowed tools | Rationale |
|---|---|---|
| Content Agent *(exists)* | `save_content_version`, `get_book_status` | slice 002 §7.4 |
| **Cover Design Agent** *(new)* | `get_cover_assets`, `save_cover_asset`, `get_book_status` | its entire persistent state is `cover_assets` |
| **Formatting Agent** *(new)* | `get_book_status`, `run_formatting_job`, `get_formatting_job_status` | its entire persistent state is `formatting_jobs` |
| **Publishing Advisor Agent** *(new)* | `get_book_status`, `create_publishing_record`, `get_publishing_record` | `create_publishing_record` records *intent only*; it never submits |
| Marketing/Ads Agent | **none — not wired** | needs a `ads-platforms` MCP server that does not exist. No `ebook-data` tool has anything to do with ad campaigns. |
| Voice Agent | **none — not wired** | needs TTS generation + `narrations` storage. Neither exists. |
| Support/Onboarding Agent | **none — not wired** | needs `search_help_library`, which reads the `documents`/`embeddings` reference library — not built. |
| Publishing submission | **not wired** | `submit_for_publishing` is a separate, approval-gated server (Constitution Article IV.6). Not built. |

The allowlists are **disjoint**. No specialist can reach another's tables. A
test asserts this pairwise, because "narrow tools over broad ones" is a
constitution rule and not a style preference.

## 3. Honesty requirement — the reason this slice is not larger

Each of the three wired specialists is **partially** capable: it can do the
data-shaped half of its job and not the external half.

- The Cover Design Agent can list cover variants and record a customer's
  choice. It **cannot generate an image** — no image-generation tool is built.
- The Formatting Agent can queue an export job and report its status. It
  **cannot produce a file** — `run_formatting_job` records intent only, by
  design (slice 002 T012 pins this).
- The Publishing Advisor Agent can record publishing intent and report status.
  It **cannot submit to any platform** — that is the approval-gated server,
  deliberately unbuilt.

An agent that is wired but quietly over-promises is a worse product than one
that is absent, and it violates the ratified prompt rule directly. So:

1. Every wired agent's `description` (which is what the Orchestrator routes on)
   states the *narrow, real* capability, not the aspirational one.
2. The Orchestrator system prompt gains a per-specialist routing line naming
   exactly what each can do, and an explicit statement of what is not yet
   available so the Orchestrator tells the customer plainly instead of routing
   into a dead end.
3. The three agents' `instructions.py` gain a "not available yet" clause so the
   model itself will not claim to have generated an image, produced a file, or
   published a book.

**This is a scope decision, not an oversight.** The alternative — wiring all
seven with placeholder tools — would produce exactly the pretending the
constitution forbids.

## 4. Composition

`build_orchestrator()` attaches four sub-agents: Content, Cover Design,
Formatting, Publishing Advisor. Each is built **fresh per call**, because ADK
assigns the parent on composition and a shared singleton fails a second parent
build with "Agent already has a parent agent" (the reason `build_content_agent`
exists at all).

`streaming=True` still suppresses the Content Agent's book-data toolset — during
a stream the Orchestrator owns the write transaction (slice 002 §7.2). The three
new specialists are never on that path; they only act on discrete requests, so
they always get their toolsets.

## 5. Acceptance criteria

- **AC1** Every wired specialist is constructed with an explicit, disjoint tool
  allowlist, and the allowlist is a subset of the server's 8 tools.
- **AC2** No wired specialist's toolset contains a tool outside its allowlist
  (a tool added to the server later cannot leak in).
- **AC3** The Orchestrator composes exactly four sub-agents, each built fresh
  (building twice does not raise).
- **AC4** The system prompt's routing section names only the four wired
  specialists, and no longer contains the "only the Content Agent is wired up"
  special case.
- **AC5** Each wired specialist's instructions state its real capability and
  explicitly disclaim the unbuilt external action, so it cannot claim to have
  generated an image, produced a file, or published a book.
- **AC6** `tenant_id`/`account_id` are never derived from conversation text in
  any of the three new agents — the same rule the Content Agent follows.
- **AC7** `ruff` and `pyright` green in all three new agent projects and in the
  Orchestrator; the Orchestrator's 47 DB-backed tests still pass.

## 6. Not in this slice

Explicitly deferred, each needing its own spec: image generation (Cover
Design's missing half), file conversion (Formatting's), the approval-gated
`publishing-platforms` server, the `ads-platforms` server + Lago checkout, TTS
narration, the reference-library semantic search, and the Skills that depend on
them.

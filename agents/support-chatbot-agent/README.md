# support-chatbot-agent

The Onboarding/Support Chatbot Agent (AGENTS.md §4): answers questions, reduces
first-use fear, recommends next steps, escalates to human support when stuck.

**Status: NOT WIRED. No tools, no sub-agent role.** This project is a
placeholder created during slice 001 scaffolding and deliberately left
unconnected.

## Why it is empty

Slice 003 (`specs/003-specialist-roster/spec.md` §2–3) considered wiring it and
declined: its defining capability is `search_help_library` over the
`documents` / `embeddings` tables (AGENTS.md §8 reference library), and neither
table nor the pgvector semantic search exists yet. Without precedent to search,
the agent could only guess — and guessing at a support answer is worse than
saying nothing.

## What wiring it will require

Its own spec, and all of the following before it can be attached:

1. **`documents` + `embeddings` tables** with pgvector, and an embedding
   pipeline to populate them.
2. A **`search_help_library` tool** — scoped, tenant-filtered, read-only.
3. A **`build_support_chatbot_agent(...)`** replacing the module-level
   singleton, so double composition is safe.
4. Tests matching slice 003's AC1–AC7.

The `escalate-to-human-support`, `onboarding-first-book-walkthrough`, and
`search_help_library`-adjacent skills describe the intended behaviour but are
documentation today, not wired capabilities.

## Run

Nothing to run — this module is imported by no one.

```sh
uv sync
uv run ruff check . && uv run pyright
```

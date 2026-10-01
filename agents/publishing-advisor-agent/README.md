# publishing-advisor-agent

The Publishing Advisor Agent (AGENTS.md §4): platform-specific rules (KDP,
Apple Books, IngramSpark, Draft2Digital), metadata, categories, ISBN guidance,
and the actual submission call.

**Slice:** 003 (specialist roster). Spec: `specs/003-specialist-roster/spec.md`.

## What it is — and is not

- `build_publishing_advisor_agent(*, model=None, with_book_data_tools=True)`
  returns a fresh `LlmAgent`, safe to build more than once (ADK assigns a parent
  on composition, so a module-level singleton fails the second parent build).
- **Tools** (`bookdata.py`): an `McpToolset` over the `ebook-data` server
  filtered to `PUBLISHING_ADVISOR_TOOLS` — `create_publishing_record` and
  `get_publishing_record`. Disjoint from every other specialist's allowlist.
- **It does not submit to any platform.** `create_publishing_record` records
  intent as `pending` and makes no external call — proven by an AST sweep and
  a monkeypatched `socket` in slice 002's AC7 test. The gated
  `publishing-platforms` MCP server, which would perform the real submission
  behind the human-approval gate (AGENTS.md §3.7), does not exist yet and needs
  its own spec.
- Its instructions disclaim the external action explicitly rather than
  describing a submission that cannot happen.

`tenant_id` / `account_id` are passed as tool arguments by the Orchestrator from
the authenticated session. This module never derives them from model output.

## Run

Not a standalone service; imported by the Orchestrator.

```sh
uv sync
uv run uvicorn orchestrator.server:app --port 8080   # from agents/orchestrator
```

Env: `PUBLISHING_ADVISOR_AGENT_MODEL` (default `gemini-flash-latest`),
`EBOOK_DATA_URL`, `DATABASE_URL`.

## Test

Covered by `agents/orchestrator/tests/test_specialist_toolsets.py` and
`test_composition.py`. Lint and types are checked from the Orchestrator project,
which depends on this one as an editable path dependency.

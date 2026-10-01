# cover-design-agent

The Cover Design Agent (AGENTS.md §4): cover concepts, prompts to image
models, variants.

**Slice:** 003 (specialist roster). Spec: `specs/003-specialist-roster/spec.md`.

## What it is — and is not

- `build_cover_design_agent(*, model=None, with_book_data_tools=True)` returns
  a fresh `LlmAgent`, safe to build more than once (ADK assigns a parent on
  composition, so a module-level singleton fails the second parent build).
- **Tools** (`bookdata.py`): an `McpToolset` over the `ebook-data` server
  filtered to `COVER_AGENT_TOOLS` — `save_cover_asset` and `get_cover_assets`.
  Disjoint from every other specialist's allowlist.
- **It does not generate images.** That is the missing half of this agent and
  is explicitly out of scope for slice 003. Its `description` and instructions
  claim only what it can actually do, and say so, rather than pretending
  otherwise.

`tenant_id` / `account_id` are passed as tool arguments by the Orchestrator from
the authenticated session. This module never derives them from model output.

## Run

Not a standalone service; imported by the Orchestrator.

```sh
uv sync
uv run uvicorn orchestrator.server:app --port 8080   # from agents/orchestrator
```

Env: `COVER_DESIGN_AGENT_MODEL` (default `gemini-flash-latest`),
`EBOOK_DATA_URL`, `DATABASE_URL`.

## Test

Covered by `agents/orchestrator/tests/test_specialist_toolsets.py` (allowlist
membership, disjointness, no cross-table tools) and `test_composition.py`
(sub-agent parenting, build-twice safety). Lint and types are checked from the
Orchestrator project, which depends on this one as an editable path dependency.

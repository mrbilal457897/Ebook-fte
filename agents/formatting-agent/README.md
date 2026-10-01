# formatting-agent

The Formatting Agent (AGENTS.md §4): sizing/trim, interior layout, and
EPUB/MOBI/PDF export.

**Slice:** 003 (specialist roster). Spec: `specs/003-specialist-roster/spec.md`.

## What it is — and is not

- `build_formatting_agent(*, model=None, with_book_data_tools=True)` returns a
  fresh `LlmAgent`, safe to build more than once (ADK assigns a parent on
  composition, so a module-level singleton fails the second parent build).
- **Tools** (`bookdata.py`): an `McpToolset` over the `ebook-data` server
  filtered to `FORMATTING_AGENT_TOOLS` — `run_formatting_job` and
  `get_formatting_job_status`. Disjoint from every other specialist's
  allowlist.
- **It does not convert files.** `run_formatting_job` records a job as
  `queued`; no EPUB/MOBI/PDF is produced. That is the missing half of this
  agent and is explicitly out of scope for slice 003. The instructions say so
  rather than implying a conversion happened.
- It is never on the streaming path, so the Orchestrator does not need the
  `with_book_data_tools=False` variant for it.

`tenant_id` / `account_id` are passed as tool arguments by the Orchestrator from
the authenticated session. This module never derives them from model output.

## Run

Not a standalone service; imported by the Orchestrator.

```sh
uv sync
uv run uvicorn orchestrator.server:app --port 8080   # from agents/orchestrator
```

Env: `FORMATTING_AGENT_MODEL` (default `gemini-flash-latest`),
`EBOOK_DATA_URL`, `DATABASE_URL`.

## Test

Covered by `agents/orchestrator/tests/test_specialist_toolsets.py` and
`test_composition.py`. Lint and types are checked from the Orchestrator project,
which depends on this one as an editable path dependency.

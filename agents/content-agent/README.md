# content-agent

The Content Agent (AGENTS.md §4): book text and chapter generation, editing,
tone control.

**Slice:** 001 (built). Slice 002 (wired) attached the `ebook-data` MCP
toolset. Slice 003 (roster) made the agent a buildable sub-agent of the
Orchestrator. Specs: `specs/001-free-tier-content-generation/`,
`specs/002-ebook-data-mcp/`.

## What it is

- **`build_content_agent(*, model=None, with_book_data_tools=True)`** returns a
  fresh `LlmAgent`. A module-level singleton is wrong here: ADK assigns the
  parent on composition, so a reused instance fails with "Agent already has a
  parent agent".
- **Tools** (`bookdata.py`): an `McpToolset` over the `ebook-data` server
  filtered to `CONTENT_AGENT_TOOLS` — an explicit allowlist of
  `save_content_version` and `get_book_status`. A tool added to the server
  later is not silently exposed to this agent.
- `with_book_data_tools=False` builds the agent with no tools. The Orchestrator
  passes `not streaming` because during a stream it owns the write transaction
  (lease renewal shares the commit) and a second writer on the same row would
  race it.
- **`tenant_id` / `account_id` are arguments, never derived from conversation
  text.** The Orchestrator supplies them from the authenticated session, and
  the MCP server rejects a missing or malformed scope before running any SQL —
  so a wrong value fails closed.

## Run

Not a standalone service. It is imported by the Orchestrator, which is the
process to start:

```sh
uv sync
uv run uvicorn orchestrator.server:app --port 8080   # from agents/orchestrator
```

Env: `CONTENT_AGENT_MODEL` (default `gemini-flash-latest`), `EBOOK_DATA_URL`,
`DATABASE_URL`, `GOOGLE_API_KEY`.

## Test

No test suite of its own — this agent's behaviour is covered by the
Orchestrator's (`agents/orchestrator/tests/`) and the MCP server's
(`mcp-servers/ebook-data/tests/`). Lint and types are checked from the
Orchestrator project, which depends on this one as an editable path
dependency.

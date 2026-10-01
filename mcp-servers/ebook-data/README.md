# ebook-data

Custom MCP server (AGENTS.md §7.3) giving the specialist agents narrow,
audited access to the shared book tables. Used by Content Agent, Cover Design
Agent, Formatting Agent, and Publishing Advisor Agent.

See `specs/002-ebook-data-mcp/spec.md` for the full spec and schema assumptions.

## What it is

- **Transport**: stateless streamable HTTP (`stateless_http=True`) — not
  stdio; multiple agent processes call it.
- **Exactly 8 tools**, nothing broader (no `run_query`, no catch-all updaters,
  no admin/schema capability). Constitution Article IV.3–4.
- **Every tool** requires `tenant_id` + `account_id` and filters by both.
- **Writes** insert `audit_log` + `capability_invocations` rows in the same
  transaction (Article VIII). Reads record `capability_invocations` only.
- **Parameterized queries only**; no raw SQL built from arguments.

## Tools

| Tool | Kind | Writes |
|------|------|--------|
| `save_content_version` | write | `content_versions` (additive versioning) |
| `get_book_status` | read | — |
| `save_cover_asset` | write | `cover_assets` (one selected per book, in-transaction) |
| `get_cover_assets` | read | — |
| `run_formatting_job` | write | `formatting_jobs` (queued; no external work) |
| `get_formatting_job_status` | read | — (tenant/account-scoped lookup) |
| `create_publishing_record` | write | `publishing_records` (pending: intent only, no external submit) |
| `get_publishing_record` | read | — |

## Run

```sh
export DATABASE_URL='postgres://user:pass@localhost:5432/ebookfte'
uv run ebook-data                 # or: uv run python -m ebook_data.server
```

Env: `DATABASE_URL` (required); `EBOOK_DATA_HOST` (127.0.0.1),
`EBOOK_DATA_PORT` (8000), `EBOOK_DATA_POOL_MIN/MAX` (1/10).

## How the agents reach it

Each specialist agent builds its own `McpToolset` in its `bookdata.py` module,
pointed at `EBOOK_DATA_URL` and narrowed by an explicit `tool_filter`:

| Agent | Allowlist |
|---|---|
| Content | `save_content_version`, `get_book_status` |
| Cover Design | `save_cover_asset`, `get_cover_assets` |
| Formatting | `run_formatting_job`, `get_formatting_job_status` |
| Publishing Advisor | `create_publishing_record`, `get_publishing_record` |

The filter is an allowlist, not a blacklist, so a tool added here later is not
silently exposed to an agent. `tenant_id` / `account_id` are passed as tool
arguments by the Orchestrator, derived from the authenticated session — never
from model output or conversation text.

The Orchestrator is the one recorded exception: it calls the database directly
for exactly three transaction shapes (`spec.md` §7).
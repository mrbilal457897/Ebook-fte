# marketing-ads-agent

The Marketing/Ads Agent (AGENTS.md §4): ad copy, targeting suggestions, and
campaign creation on the end-customer's own connected ad account.

**Status: NOT WIRED. No tools, no sub-agent role.** This project is a
placeholder created during slice 001 scaffolding and deliberately left
unconnected.

## Why it is empty

Slice 003 (`specs/003-specialist-roster/spec.md` §2–3) considered wiring it and
declined: this agent's entire value is the external ad-platform call, and
`mcp-servers/ads-platforms/` does not exist. Attaching it with a
placeholder/no-op toolset would be exactly the "pretending" the Constitution
forbids, so it was left out of the Orchestrator's sub-agent list and said so in
the Orchestrator's prompt.

## What wiring it will require

Its own spec, and all of the following before it can be attached:

1. **`mcp-servers/ads-platforms/`** — a narrow MCP server for Meta Ads and
   Google Ads, with spend above a threshold behind an explicit ADK approval step
   (AGENTS.md §3.7). OAuth tokens land in `ad_accounts`; campaigns and
   spend-so-far in `ad_campaigns`. Neither table exists yet.
2. **`bookdata.py`** — a `MARKETING_AGENT_TOOLS` allowlist, disjoint from the
   four wired specialists.
3. **`build_marketing_ads_agent(...)`** replacing the module-level singleton, so
   double composition is safe.
4. Tests matching slice 003's AC1–AC7 (allowlist disjointness, no
   `tenant_id` from conversation text, prompt honesty).

The `ad-copy-generator` and `audience-targeting-suggester` skills already cover
the copy and targeting halves conceptually; they need the campaign-creation tool
to be useful end to end.

## Run

Nothing to run — this module is imported by no one.

```sh
uv sync
uv run ruff check . && uv run pyright
```

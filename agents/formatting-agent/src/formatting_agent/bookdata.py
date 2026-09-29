"""MCP client for the Formatting Agent's share of the ebook-data server.

Mirrors `content_agent/bookdata.py` (specs/002-ebook-data-mcp/spec.md §7.4).
The Formatting Agent's entire persistent state is `formatting_jobs`, plus the
one read it needs to know which book it is working on, so it gets exactly those
three tools.

`FORMATTING_AGENT_TOOLS` is an explicit allowlist rather than a name-derived
filter, so a tool added to the server later is not silently exposed here
(AGENTS.md §7.3, Principle 6). This agent can never reach `content_versions`
(Content Agent), `cover_assets` (Cover Design Agent), or
`publishing_records` (Publishing Advisor Agent) — the four allowlists are
disjoint by construction.

`run_formatting_job` records *intent only* by design (slice 002 T012 pins this
with a test asserting no network client is imported anywhere in the package).
This agent therefore cannot produce a file, and its instructions say so rather
than letting the model imply an export happened.

`tenant_id`/`account_id` are supplied by the Orchestrator from the
authenticated session and passed as tool arguments. Nothing here derives them
from conversation text, and the server rejects a missing or malformed scope
before running any SQL, so a wrong value fails closed.
"""

import os

from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StreamableHTTPConnectionParams,
)

FORMATTING_AGENT_TOOLS: frozenset[str] = frozenset(
    {"get_book_status", "run_formatting_job", "get_formatting_job_status"}
)

DEFAULT_EBOOK_DATA_URL = "http://localhost:8081/mcp"


def ebook_data_url() -> str:
    return os.environ.get("EBOOK_DATA_URL", "").strip() or DEFAULT_EBOOK_DATA_URL


def build_book_data_toolset(*, url: str | None = None) -> McpToolset:
    """The Formatting Agent's book-data toolset, scoped to
    `FORMATTING_AGENT_TOOLS`.

    Built fresh per agent instance: ADK assigns the parent on composition, and a
    `McpToolset` holds a live session, so it must not be shared across two
    agent builds any more than a sub-agent should be.
    """
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url or ebook_data_url(),
        ),
        tool_filter=list(FORMATTING_AGENT_TOOLS),
    )

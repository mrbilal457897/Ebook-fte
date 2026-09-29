"""MCP client for the Cover Design Agent's share of the ebook-data server.

Mirrors `content_agent/bookdata.py` (specs/002-ebook-data-mcp/spec.md §7.4):
the Cover Design Agent's entire persistent state is `cover_assets`, so it gets
exactly the three tools that touch that table and nothing else.

`COVER_AGENT_TOOLS` is an explicit allowlist rather than a filter derived from
the tool names, so a tool added to the server later is not silently exposed to
this agent (AGENTS.md §7.3, Principle 6). In particular this agent can never
reach `content_versions`, `formatting_jobs`, or `publishing_records` — those
belong to the Content, Formatting, and Publishing Advisor agents respectively,
and the three allowlists are disjoint by construction.

Note the deliberate absence: this agent has no image-generation tool, because
none is built (specs/003-specialist-roster/spec.md §3). It can list cover
variants and record the customer's choice; it cannot make a new image, and its
instructions say so rather than letting the model imply otherwise.

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

COVER_AGENT_TOOLS: frozenset[str] = frozenset(
    {"get_cover_assets", "save_cover_asset", "get_book_status"}
)

DEFAULT_EBOOK_DATA_URL = "http://localhost:8081/mcp"


def ebook_data_url() -> str:
    return os.environ.get("EBOOK_DATA_URL", "").strip() or DEFAULT_EBOOK_DATA_URL


def build_book_data_toolset(*, url: str | None = None) -> McpToolset:
    """The Cover Design Agent's book-data toolset, scoped to `COVER_AGENT_TOOLS`.

    Built fresh per agent instance: ADK assigns the parent on composition, and a
    `McpToolset` holds a live session, so it must not be shared across two
    agent builds any more than a sub-agent should be.
    """
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url or ebook_data_url(),
        ),
        tool_filter=list(COVER_AGENT_TOOLS),
    )

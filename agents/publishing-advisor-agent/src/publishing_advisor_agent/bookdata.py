"""MCP client for the Publishing Advisor Agent's share of the ebook-data server.

Mirrors `content_agent/bookdata.py` (specs/002-ebook-data-mcp/spec.md §7.4).
The Publishing Advisor Agent's persistent state is `publishing_records`, plus
the book-status read it needs to check what stage the book is at, so it gets
exactly those three tools.

`PUBLISHING_ADVISOR_TOOLS` is an explicit allowlist rather than a name-derived
filter, so a tool added to the server later is not silently exposed here
(AGENTS.md §7.3, Principle 6). This agent can never reach `content_versions`,
`cover_assets`, or `formatting_jobs` — those belong to the other three
specialists, and the four allowlists are disjoint by construction.

The tool this agent is *named* for — the approval-gated `submit_for_publishing`
that actually submits to KDP/Apple Books/IngramSpark — is deliberately NOT here.
It belongs to a separate `publishing-platforms` MCP server that does not exist
yet (Constitution Article IV.6; specs/003-specialist-roster/spec.md §3, §6).
`create_publishing_record` records *intent only* and never leaves the database.
The agent's instructions say exactly that, so it cannot imply a book went live.

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

PUBLISHING_ADVISOR_TOOLS: frozenset[str] = frozenset(
    {"get_book_status", "create_publishing_record", "get_publishing_record"}
)

DEFAULT_EBOOK_DATA_URL = "http://localhost:8081/mcp"


def ebook_data_url() -> str:
    return os.environ.get("EBOOK_DATA_URL", "").strip() or DEFAULT_EBOOK_DATA_URL


def build_book_data_toolset(*, url: str | None = None) -> McpToolset:
    """The Publishing Advisor Agent's book-data toolset, scoped to
    `PUBLISHING_ADVISOR_TOOLS`.

    Built fresh per agent instance: ADK assigns the parent on composition, and a
    `McpToolset` holds a live session, so it must not be shared across two
    agent builds any more than a sub-agent should be.
    """
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url or ebook_data_url(),
        ),
        tool_filter=list(PUBLISHING_ADVISOR_TOOLS),
    )

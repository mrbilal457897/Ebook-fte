"""MCP client for the Content Agent's share of the ebook-data server.

Per specs/002-ebook-data-mcp/spec.md §7.4, the Content Agent reaches
`content_versions` through the `ebook-data` MCP server rather than by direct
SQL. The Orchestrator's streaming persistence is the one recorded exception
(§7.2) because it must share a transaction with the lease row; this module is
everything else.

Two properties this module is responsible for:

1. **Narrow surface.** `McpToolset(tool_filter=...)` restricts the agent to the
   two tools it has any business calling. The server's other six are never
   presented to the model, so it cannot reach covers, formatting, or publishing
   records even if a customer's text talks it into trying (Constitution
   Article IV.5/6).

2. **Session-derived scope.** `tenant_id`/`account_id` are supplied by the
   Orchestrator from the authenticated session and passed as tool arguments.
   This module never derives them from conversation text. The server itself
   rejects a missing or malformed scope before running any SQL, so a wrong
   value fails closed rather than reading another tenant's rows.
"""

import os

from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StreamableHTTPConnectionParams,
)

# The only two of the server's eight tools the Content Agent may call. Kept as
# an explicit allowlist so a future tool added to the server is not silently
# exposed to this agent (AGENTS.md §7.3, Principle 6).
CONTENT_AGENT_TOOLS: frozenset[str] = frozenset(
    {"save_content_version", "get_book_status"}
)

DEFAULT_EBOOK_DATA_URL = "http://localhost:8081/mcp"


def ebook_data_url() -> str:
    return os.environ.get("EBOOK_DATA_URL", "").strip() or DEFAULT_EBOOK_DATA_URL


def build_book_data_toolset(*, url: str | None = None) -> McpToolset:
    """The Content Agent's book-data toolset, scoped to `CONTENT_AGENT_TOOLS`.

    Built fresh per agent instance: ADK assigns the parent on composition, and
    a `McpToolset` holds a live session, so it must not be shared across two
    agent builds any more than a sub-agent should be.
    """
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url or ebook_data_url(),
        ),
        tool_filter=list(CONTENT_AGENT_TOOLS),
    )

"""MCP client for the Publishing Advisor Agent's platform-requirements server.

This connects to the platform-requirements MCP server (Slice 004) to expose
lookup_platform_requirements and alidate_package. Both are read-only.
"""
import os

from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StreamableHTTPConnectionParams,
)

PLATFORM_REQ_TOOLS: frozenset[str] = frozenset(
    {"lookup_platform_requirements", "validate_package"}
)

DEFAULT_PLATFORM_REQ_URL = "http://localhost:8082/mcp"


def platform_req_url() -> str:
    return os.environ.get("PLATFORM_REQ_URL", "").strip() or DEFAULT_PLATFORM_REQ_URL


def build_platform_req_toolset(*, url: str | None = None) -> McpToolset:
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url or platform_req_url(),
        ),
        tool_filter=list(PLATFORM_REQ_TOOLS),
    )

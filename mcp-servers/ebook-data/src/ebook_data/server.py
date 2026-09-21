"""ebook-data MCP server entrypoint.

Registers exactly the tools in tools.py (no broader surface — no admin or
schema capability), served over stateless streamable HTTP (AGENTS.md §7.3).
"""

from mcp.server.mcpserver import MCPServer

from ebook_data import config
from ebook_data.tools import TOOLS

server = MCPServer(
    "ebook-data",
    title="ebook-data — shared book-data tools",
    description=(
        "Narrow book-data access for the specialist agents (Content, Cover "
        "Design, Formatting, Publishing Advisor): content versions, book "
        "status, cover assets, formatting jobs, publishing records. Every "
        "tool requires tenant_id + account_id and filters by both."
    ),
    version="0.1.0",
)

for fn in TOOLS:
    server.tool()(fn)


def main() -> None:
    server.run(
        transport="streamable-http",
        host=config.HOST,
        port=config.PORT,
        stateless_http=True,
    )


if __name__ == "__main__":
    main()
"""platform-requirements MCP server entrypoint.

Registers exactly the two tools in tools.py -- both read-only. There is no
write tool, no submit tool, and no network client in this package. Served over
stateless streamable HTTP (AGENTS.md §7.3).
"""

from mcp.server.mcpserver import MCPServer

from platform_requirements import config
from platform_requirements.tools import TOOLS

server = MCPServer(
    "platform-requirements",
    title="platform-requirements — publishing rules and package pre-flight",
    description=(
        "Authoritative requirements for the publishing platforms we cover "
        "(KDP, Apple Books, IngramSpark) and pre-flight validation of a "
        "declared submission package. Every rule carries its source document. "
        "Read-only: none of these platforms has a public submission API, so "
        "this server validates and explains, and the customer performs the "
        "upload."
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

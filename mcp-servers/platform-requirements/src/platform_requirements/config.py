"""Host/port for the platform-requirements MCP server.

Stateless streamable HTTP per AGENTS.md §7.3. The port defaults to 8082 because
8080 is uvicorn and 8081 is the ebook-data server.
"""

from __future__ import annotations

import os

HOST = os.getenv("PLATFORM_REQUIREMENTS_HOST", "127.0.0.1")
PORT = int(os.getenv("PLATFORM_REQUIREMENTS_PORT", "8082"))

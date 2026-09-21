"""Runtime configuration for the ebook-data MCP server.

All values come from the environment. Real secret values (DATABASE_URL
password, BYOK keys, platform tokens) never enter logs or audit rows.
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (e.g. postgres://user:pass@localhost:5432/ebookfte)")

HOST = os.environ.get("EBOOK_DATA_HOST", "127.0.0.1")
PORT = int(os.environ.get("EBOOK_DATA_PORT", "8000"))

POOL_MIN = int(os.environ.get("EBOOK_DATA_POOL_MIN", "1"))
POOL_MAX = int(os.environ.get("EBOOK_DATA_POOL_MAX", "10"))

# agent identity recorded in capability_invocations/audit_log rows
AGENT_NAME = "ebook-data"
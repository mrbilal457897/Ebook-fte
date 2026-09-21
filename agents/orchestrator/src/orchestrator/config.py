"""Runtime configuration for the Orchestrator.

T008 requires DATABASE_URL; the full set of settings (models, generation
params, rate-limit thresholds, Lago, internal token) lands with T014 in this
same file — keep all env reads here, never scattered across modules.
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (e.g. postgres://user:pass@localhost:5432/ebookfte)")
"""Shared fixtures for Orchestrator DB-backed tests.

Per quickstart.md, migrations must already be applied to the target
database. When `DATABASE_URL` is unset the suite skips DB-backed tests
explicitly (never silently passes); CI and the quickstart set it.
"""

import os
import uuid
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest
from psycopg import Connection
from psycopg.rows import dict_row


def _dsn() -> str:
    return os.environ.get("DATABASE_URL", "").strip()


@pytest.fixture(scope="session")
def dsn() -> Iterator[str]:
    url = _dsn()
    if not url:
        pytest.skip(
            "DATABASE_URL not set — DB-backed Orchestrator tests skipped "
            "(quickstart.md: apply db/migrations, then set DATABASE_URL)"
        )
    yield url


@pytest.fixture(scope="session")
def db(dsn: str) -> Iterator[Connection[Any]]:
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    yield conn
    conn.close()


def seed_account(
    db: Connection[Any],
    *,
    free_tier_limit: int = 3,
    free_tier_count: int = 0,
) -> dict[str, str]:
    tenant_id = str(uuid.uuid4())
    account_id = str(uuid.uuid4())
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO tenants (id, name, slug) VALUES (%s, %s, %s)",
            (tenant_id, "Gate Test Tenant", f"gate-{tenant_id}"),
        )
        cur.execute(
            """
            INSERT INTO accounts
                (id, tenant_id, email, auth_subject, free_tier_count,
                 free_tier_limit, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, now(), now())
            """,
            (
                account_id,
                tenant_id,
                f"{uuid.uuid4()}@example.test",
                f"auth-{uuid.uuid4()}",
                free_tier_count,
                free_tier_limit,
            ),
        )
    return {"tenant_id": tenant_id, "account_id": account_id}


@pytest.fixture
def fresh_account(db: Connection) -> Iterator[dict[str, str]]:
    """A brand-new account row (free_tier_count=0, limit=3) in its own tenant."""
    yield seed_account(db)
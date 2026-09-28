"""Shared fixtures for ebook-data tests.

Per specs/002-ebook-data-mcp/spec.md §5, every acceptance criterion is an
automated test. The tests need the real schema (migration 0003 creates
cover_assets/formatting_jobs/publishing_records), so they are DB-backed and
skip explicitly - never silently pass - when DATABASE_URL is unset.
"""

import os
import uuid
from collections.abc import Iterator
from typing import Any, LiteralString

import psycopg
import pytest
from psycopg import Connection
from psycopg.rows import dict_row

SCOPE_TABLES = ("cover_assets", "formatting_jobs", "publishing_records")


def _dsn() -> str:
    return os.environ.get("DATABASE_URL", "").strip()


@pytest.fixture(scope="session")
def dsn() -> Iterator[str]:
    url = _dsn()
    if not url:
        pytest.skip(
            "DATABASE_URL not set - DB-backed ebook-data tests skipped "
            "(apply db/migrations, then set DATABASE_URL)"
        )
    yield url


@pytest.fixture(scope="session")
def db(dsn: str) -> Iterator[Connection[Any]]:
    conn: Connection[Any] = psycopg.connect(dsn, autocommit=True)
    conn.row_factory = dict_row
    yield conn
    conn.close()


def seed_scope(db: Connection[Any], *, label: str = "scope") -> dict[str, str]:
    """A fresh tenant + account, so every test owns its own isolation scope."""
    tenant_id = str(uuid.uuid4())
    account_id = str(uuid.uuid4())
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO tenants (id, name, slug) VALUES (%s, %s, %s)",
            (tenant_id, f"ebook-data {label}", f"ebook-data-{label}-{tenant_id}"),
        )
        cur.execute(
            """
            INSERT INTO accounts
                (id, tenant_id, email, auth_subject, free_tier_count,
                 free_tier_limit, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 0, 3, now(), now())
            """,
            (
                account_id,
                tenant_id,
                f"{uuid.uuid4()}@example.test",
                f"auth-{uuid.uuid4()}",
            ),
        )
    return {"tenant_id": tenant_id, "account_id": account_id}


def seed_book(db: Connection[Any], scope: dict[str, str], **overrides: Any) -> str:
    book_id = str(uuid.uuid4())
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO books (id, tenant_id, account_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, now(), now())
            """,
            (
                book_id,
                scope["tenant_id"],
                scope["account_id"],
                overrides.get("status", "draft"),
            ),
        )
    return book_id


def rows(
    db: Connection[Any], sql: LiteralString, params: tuple[Any, ...]
) -> list[dict[str, Any]]:
    with db.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def count(
    db: Connection[Any], sql: LiteralString, params: tuple[Any, ...]
) -> int:
    result = rows(db, sql, params)
    assert result, "count query returned no row"
    return int(next(iter(result[0].values())))


@pytest.fixture
def scope(db: Connection[Any]) -> dict[str, str]:
    return seed_scope(db)


@pytest.fixture
def book(db: Connection[Any], scope: dict[str, str]) -> str:
    return seed_book(db, scope)

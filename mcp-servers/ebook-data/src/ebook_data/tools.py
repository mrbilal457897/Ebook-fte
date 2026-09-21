"""The 8 ebook-data tools — exactly these, nothing broader.

Every tool takes tenant_id + account_id and filters by both. Writes record
audit + capability rows in the same transaction (Article VIII); reads record
capability only. Parameterized queries only (Article IV.3).

Schema assumptions: specs/002-ebook-data-mcp/data-model.md.
"""

from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Json

from ebook_data import db
from ebook_data.db import fetchall, fetchone

TOOLS: list = []


def _require_uuid(value: Any, name: str) -> UUID:
    try:
        return UUID(str(value).strip())
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"{name} must be a valid uuid, got {value!r}") from exc


def _scope(tenant_id: Any, account_id: Any) -> tuple[str, str]:
    """Validate and normalize the mandatory tenant/account scope.

    Every tool must be called with both; never read/write without them.
    """
    tenant = str(tenant_id or "").strip()
    account = str(account_id or "").strip()
    if not tenant or not account:
        raise ValueError("tenant_id and account_id are required for every tool")
    return tenant, account


def _record_write(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    action: str,
    inputs: dict[str, Any],
    output: dict[str, Any],
    started: float,
) -> None:
    db.record_invocation(
        conn, tenant_id=tenant_id, account_id=account_id, action=action,
        inputs=inputs, output=output, latency_ms=db.latency_ms(started), success=True,
    )
    db.record_audit(
        conn, tenant_id=tenant_id, account_id=account_id, action=action,
        inputs=inputs, output=output, status="success",
    )


def _record_read(
    conn: Connection,
    *,
    tenant_id: str,
    account_id: str,
    action: str,
    inputs: dict[str, Any],
    output: dict[str, Any],
    started: float,
) -> None:
    db.record_invocation(
        conn, tenant_id=tenant_id, account_id=account_id, action=action,
        inputs=inputs, output=output, latency_ms=db.latency_ms(started), success=True,
    )


def save_content_version(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
    content: str,
    is_partial: bool,
) -> str:
    """Insert a new additive content_version row (never overwrites)."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            """
            INSERT INTO content_versions (
                id, book_id, tenant_id, account_id, version_num, content,
                is_partial, created_at, updated_at)
            SELECT gen_random_uuid(), b.id, b.tenant_id, b.account_id,
                   cv.version_num + 1, %s, %s, now(), now()
            FROM books b
            LEFT JOIN LATERAL (
                SELECT COALESCE(MAX(version_num), 0) AS version_num
                FROM content_versions WHERE book_id = b.id
            ) cv ON true
            WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
            RETURNING id
            """,
            (content, is_partial, book, tenant, account),
        ))

        if row is None:
            raise ValueError(f"book {book_id} not found for this account/tenant")
        version_id = str(row["id"])
        _record_write(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="content_version.save",
            inputs={
                "book_id": str(book),
                "content_chars": len(content),
                "content_preview": content[:100],
                "is_partial": is_partial,
            },
            output={"content_version_id": version_id},
            started=started,
        )
        return version_id


TOOLS.append(save_content_version)


def get_book_status(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
) -> dict[str, Any]:
    """Read-only: current book status + stage (draft/formatting/publishing/live)."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            "SELECT status FROM books WHERE id = %s AND tenant_id = %s AND account_id = %s",
            (book, tenant, account),
        ))

        if row is None:
            raise ValueError(f"book {book_id} not found for this account/tenant")
        output = {"book_id": str(book), "status": row["status"], "stage": row["status"]}
        _record_read(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="get_book_status",
            inputs={"book_id": str(book)},
            output=output,
            started=started,
        )
        return output


TOOLS.append(get_book_status)


def save_cover_asset(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
    image_ref: str,
    is_selected: bool,
) -> str:
    """Insert a cover asset; is_selected=true unsets selection on any other
    asset of the same book in the same transaction (one selected per book)."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    started = time.perf_counter()
    with db.transaction() as conn:
        if is_selected:
            conn.execute(
                """
                UPDATE cover_assets SET is_selected = false, updated_at = now()
                WHERE book_id = %s AND tenant_id = %s AND account_id = %s AND is_selected
                """,
                (book, tenant, account),
            )
        row = fetchone(conn.execute(
            """
            INSERT INTO cover_assets (
                id, book_id, tenant_id, account_id, image_ref, is_selected,
                created_at, updated_at)
            SELECT gen_random_uuid(), b.id, b.tenant_id, b.account_id, %s, %s, now(), now()
            FROM books b
            WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
            RETURNING id
            """,
            (image_ref, is_selected, book, tenant, account),
        ))

        if row is None:
            raise ValueError(f"book {book_id} not found for this account/tenant")
        asset_id = str(row["id"])
        _record_write(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="cover_asset.save",
            inputs={
                "book_id": str(book),
                "image_ref": image_ref,
                "is_selected": is_selected,
            },
            output={"cover_asset_id": asset_id},
            started=started,
        )
        return asset_id


TOOLS.append(save_cover_asset)


def get_cover_assets(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
) -> list[dict[str, Any]]:
    """Read-only: cover variants for the book, ownership-scoped, oldest first."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    started = time.perf_counter()
    with db.transaction() as conn:
        rows = fetchall(conn.execute(
            """
            SELECT id, image_ref, is_selected FROM cover_assets
            WHERE book_id = %s AND tenant_id = %s AND account_id = %s
            ORDER BY created_at, id
            """,
            (book, tenant, account),
        ))
        assets = [
            {
                "id": str(r["id"]),
                "image_ref": r["image_ref"],
                "is_selected": bool(r["is_selected"]),
            }
            for r in rows
        ]
        _record_read(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="get_cover_assets",
            inputs={"book_id": str(book)},
            output={"count": len(assets)},
            started=started,
        )
        return assets


TOOLS.append(get_cover_assets)


def run_formatting_job(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
    target_format: str,
    content_version_id: Any,
    cover_asset_id: Any,
) -> str:
    """Record a queued formatting job (intent only — actual formatting runs
    elsewhere). Validates the referenced content_version and optional
    cover_asset belong to the same book/account/tenant."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    content_version = _require_uuid(content_version_id, "content_version_id")
    cover_asset = (
        _require_uuid(cover_asset_id, "cover_asset_id")
        if cover_asset_id not in (None, "")
        else None
    )
    fmt = str(target_format or "").strip()
    if not fmt:
        raise ValueError("target_format is required")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            """
            INSERT INTO formatting_jobs (
                id, book_id, tenant_id, account_id, target_format,
                content_version_id, cover_asset_id, status, created_at, updated_at)
            SELECT gen_random_uuid(), b.id, b.tenant_id, b.account_id,
                   %s, %s, %s, 'queued', now(), now()
            FROM books b
            WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
              AND EXISTS (
                  SELECT 1 FROM content_versions cv
                  WHERE cv.id = %s AND cv.book_id = b.id
                    AND cv.tenant_id = b.tenant_id AND cv.account_id = b.account_id
              )
              AND (%s IS NULL OR EXISTS (
                  SELECT 1 FROM cover_assets ca
                  WHERE ca.id = %s AND ca.book_id = b.id
                    AND ca.tenant_id = b.tenant_id AND ca.account_id = b.account_id
              ))
            RETURNING id
            """,
            (
                fmt,
                content_version,
                cover_asset,
                book,
                tenant,
                account,
                content_version,
                cover_asset,
                cover_asset,
            ),
        ))

        if row is None:
            raise ValueError(
                "book, content_version, or cover_asset not found for this account/tenant"
            )
        job_id = str(row["id"])
        _record_write(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="formatting_job.queued",
            inputs={
                "book_id": str(book),
                "target_format": fmt,
                "content_version_id": str(content_version),
                "cover_asset_id": str(cover_asset) if cover_asset else None,
            },
            output={"formatting_job_id": job_id},
            started=started,
        )
        return job_id


TOOLS.append(run_formatting_job)


def get_formatting_job_status(
    job_id: Any,
    account_id: Any,
    tenant_id: Any,
) -> dict[str, Any]:
    """Read-only: job status for the given account/tenant. A malformed or
    foreign job_id yields the same 'not found' error."""
    tenant, account = _scope(tenant_id, account_id)
    job = _require_uuid(job_id, "job_id")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            """
            SELECT id, book_id, target_format, content_version_id, cover_asset_id,
                   status, created_at, updated_at
            FROM formatting_jobs
            WHERE id = %s AND tenant_id = %s AND account_id = %s
            """,
            (job, tenant, account),
        ))

        if row is None:
            raise ValueError(f"job {job_id} not found for this account/tenant")
        output = {
            "formatting_job_id": str(row["id"]),
            "book_id": str(row["book_id"]),
            "target_format": row["target_format"],
            "content_version_id": str(row["content_version_id"]),
            "cover_asset_id": str(row["cover_asset_id"]) if row["cover_asset_id"] else None,
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        _record_read(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="get_formatting_job_status",
            inputs={"formatting_job_id": str(job)},
            output={"formatting_job_id": str(job), "status": row["status"]},
            started=started,
        )
        return output


TOOLS.append(get_formatting_job_status)


def create_publishing_record(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
    platform: str,
    metadata: dict[str, Any],
) -> str:
    """Record publishing intent (status='pending') only.

    Never submits anywhere external — the approval-gated submission belongs to
    the separate `publishing-platforms` MCP server (Constitution Article IV.6).
    """
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    plat = str(platform or "").strip()
    if not plat:
        raise ValueError("platform is required")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            """
            INSERT INTO publishing_records (
                id, book_id, tenant_id, account_id, platform, metadata, status,
                created_at, updated_at)
            SELECT gen_random_uuid(), b.id, b.tenant_id, b.account_id,
                   %s, %s, 'pending', now(), now()
            FROM books b
            WHERE b.id = %s AND b.tenant_id = %s AND b.account_id = %s
            RETURNING id
            """,
            (plat, Json(metadata or {}), book, tenant, account),
        ))

        if row is None:
            raise ValueError(f"book {book_id} not found for this account/tenant")
        record_id = str(row["id"])
        _record_write(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="publishing_record.created",
            inputs={"book_id": str(book), "platform": plat},
            output={"publishing_record_id": record_id},
            started=started,
        )
        return record_id


TOOLS.append(create_publishing_record)


def get_publishing_record(
    book_id: Any,
    account_id: Any,
    tenant_id: Any,
    platform: str,
) -> dict[str, Any]:
    """Read-only: the latest publishing record for a book/platform, scoped by
    account and tenant."""
    tenant, account = _scope(tenant_id, account_id)
    book = _require_uuid(book_id, "book_id")
    plat = str(platform or "").strip()
    if not plat:
        raise ValueError("platform is required")
    started = time.perf_counter()
    with db.transaction() as conn:
        row = fetchone(conn.execute(
            """
            SELECT id, book_id, platform, metadata, status, created_at, updated_at
            FROM publishing_records
            WHERE book_id = %s AND tenant_id = %s AND account_id = %s AND platform = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (book, tenant, account, plat),
        ))

        if row is None:
            raise ValueError(
                f"publishing record for platform '{plat}' not found for this account/tenant"
            )
        output = {
            "publishing_record_id": str(row["id"]),
            "book_id": str(row["book_id"]),
            "platform": row["platform"],
            "metadata": row["metadata"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        _record_read(
            conn,
            tenant_id=tenant,
            account_id=account,
            action="get_publishing_record",
            inputs={"book_id": str(book), "platform": plat},
            output={
                "publishing_record_id": str(row["id"]),
                "status": row["status"],
            },
            started=started,
        )
        return output


TOOLS.append(get_publishing_record)
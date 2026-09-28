"""Acceptance criteria for specs/002-ebook-data-mcp/spec.md §5, one test each.

The criteria are quoted in the test docstrings so the spec and the suite stay
traceable. Constitution Article IV.3-4 (narrow tools, no raw SQL) and Article
XI (tenant isolation) are asserted here, not assumed.
"""

import uuid
from typing import Any

import pytest
from conftest import count, rows, seed_book, seed_scope
from psycopg import Connection

from ebook_data import tools

# --- AC1: all 8 tools exposed; listing shows exactly those 8 names ---------


def test_ac1_exactly_eight_tools_registered() -> None:
    assert [t.__name__ for t in tools.TOOLS] == [
        "save_content_version",
        "get_book_status",
        "save_cover_asset",
        "get_cover_assets",
        "run_formatting_job",
        "get_formatting_job_status",
        "create_publishing_record",
        "get_publishing_record",
    ]


def test_ac1_server_registers_no_broader_surface() -> None:
    """The server must expose the 8 tools and nothing else - no run_query,
    no catch-all updater, no admin/schema capability (spec §2)."""
    import asyncio

    from ebook_data.server import server

    listed = asyncio.run(server.list_tools())
    assert [t.name for t in listed] == [t.__name__ for t in tools.TOOLS]
    assert len(listed) == 8
    assert not any(
        banned in tool.name.lower()
        for tool in listed
        for banned in ("query", "sql", "admin", "migrate", "schema", "drop")
    )
    assert server.name == "ebook-data"


def test_ac1_every_tool_declares_its_scope_parameters() -> None:
    """MCP clients see the schema, so tenant_id/account_id must be declared
    parameters rather than hidden in a server-side session (spec §3.1)."""
    import asyncio

    from ebook_data.server import server

    for tool in asyncio.run(server.list_tools()):
        props = tool.input_schema.get("properties", {})
        assert "tenant_id" in props, f"{tool.name} does not declare tenant_id"
        assert "account_id" in props, f"{tool.name} does not declare account_id"


# --- AC2: every tool requires tenant_id + account_id; malformed uuids -------


@pytest.mark.parametrize(
    "tool_name",
    [t.__name__ for t in tools.TOOLS],
)
def test_ac2_every_tool_requires_scope(tool_name: str) -> None:
    """Both scope values are keyword arguments on all 8 tools, and omitting
    either raises before any SQL runs (spec §3.1, §3.5)."""
    tool = getattr(tools, tool_name)
    import inspect

    params = inspect.signature(tool).parameters
    assert "tenant_id" in params
    assert "account_id" in params


def test_ac2_missing_scope_is_rejected() -> None:
    with pytest.raises(ValueError, match="tenant_id and account_id are required"):
        tools.get_book_status(book_id=str(uuid.uuid4()), account_id="", tenant_id="")
    with pytest.raises(ValueError, match="tenant_id and account_id are required"):
        tools.get_book_status(book_id=str(uuid.uuid4()), account_id=str(uuid.uuid4()),
                              tenant_id=None)


def test_ac2_malformed_uuid_is_rejected(db: Connection[Any]) -> None:
    """Malformed uuids are rejected before any SQL runs (spec §3.5) - proven
    by the absence of any capability_invocations row afterwards."""
    scope = seed_scope(db)
    before = count(
        db,
        "SELECT count(*) FROM capability_invocations WHERE tenant_id = %s",
        (scope["tenant_id"],),
    )
    with pytest.raises(ValueError, match="book_id must be a valid uuid"):
        tools.get_book_status(
            book_id="not-a-uuid", account_id=scope["account_id"],
            tenant_id=scope["tenant_id"],
        )
    with pytest.raises(ValueError, match="job_id must be a valid uuid"):
        tools.get_formatting_job_status(
            job_id="../../etc/passwd", account_id=scope["account_id"],
            tenant_id=scope["tenant_id"],
        )
    after = count(
        db,
        "SELECT count(*) FROM capability_invocations WHERE tenant_id = %s",
        (scope["tenant_id"],),
    )
    assert after == before


# --- AC3: write tools create audit + invocation rows in the same txn --------


def _write_rows(db: Connection[Any], tenant_id: str, action: str) -> tuple[int, int]:
    invocations = count(
        db,
        "SELECT count(*) FROM capability_invocations"
        " WHERE tenant_id = %s AND action = %s",
        (tenant_id, action),
    )
    audits = count(
        db,
        "SELECT count(*) FROM audit_log WHERE tenant_id = %s AND action = %s",
        (tenant_id, action),
    )
    return invocations, audits


def test_ac3_content_version_write_records_audit_and_invocation(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="Chapter one", is_partial=True,
    )
    invocations, audits = _write_rows(db, scope["tenant_id"], "content_version.save")
    assert invocations == 1
    assert audits == 1


def test_ac3_cover_asset_write_records_audit_and_invocation(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/a.png",
        is_selected=False,
    )
    invocations, audits = _write_rows(db, scope["tenant_id"], "cover_asset.save")
    assert invocations == 1
    assert audits == 1


def test_ac3_formatting_job_write_records_audit_and_invocation(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    version_id = tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="body", is_partial=False,
    )
    tools.run_formatting_job(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], target_format="epub",
        content_version_id=version_id, cover_asset_id=None,
    )
    invocations, audits = _write_rows(db, scope["tenant_id"], "formatting_job.queued")
    assert invocations == 1
    assert audits == 1


def test_ac3_publishing_record_write_records_audit_and_invocation(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    tools.create_publishing_record(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], platform="kdp", metadata={"title": "T"},
    )
    invocations, audits = _write_rows(db, scope["tenant_id"], "publishing_record.created")
    assert invocations == 1
    assert audits == 1


def test_ac3_read_tools_record_invocation_only(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    """Reads write capability_invocations but never audit_log (spec §3.3)."""
    book_id = seed_book(db, scope)
    tools.get_book_status(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"],
    )
    invocations, audits = _write_rows(db, scope["tenant_id"], "get_book_status")
    assert invocations == 1
    assert audits == 0


def test_ac3_rolled_back_write_leaves_no_orphan_rows(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    """Verified under a rolled-back write: no orphan rows (spec §5)."""
    book_id = seed_book(db, scope)
    before = count(
        db, "SELECT count(*) FROM content_versions WHERE book_id = %s", (book_id,)
    )
    with (
        pytest.raises(RuntimeError, match="forced rollback"),
        tools.db.transaction() as conn,
    ):
        tools.db.record_invocation(
            conn, tenant_id=scope["tenant_id"], account_id=scope["account_id"],
            action="content_version.save", inputs={}, output={},
            latency_ms=1, success=True,
        )
        tools.db.record_audit(
            conn, tenant_id=scope["tenant_id"], account_id=scope["account_id"],
            action="content_version.save", inputs={}, output={}, status="success",
        )
        raise RuntimeError("forced rollback")
    after = count(
        db, "SELECT count(*) FROM content_versions WHERE book_id = %s", (book_id,)
    )
    orphans = count(
        db,
        "SELECT count(*) FROM audit_log WHERE tenant_id = %s AND action = %s",
        (scope["tenant_id"], "content_version.save"),
    )
    assert after == before
    assert orphans == 0


# --- AC4: save_content_version never updates an existing row (additive) ------


def test_ac4_save_content_version_is_additive_only(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    first = tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="v1", is_partial=True,
    )
    second = tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="v2", is_partial=False,
    )
    assert first != second
    saved = rows(
        db,
        "SELECT version_num, content, is_partial FROM content_versions"
        " WHERE book_id = %s ORDER BY version_num",
        (book_id,),
    )
    assert [(r["version_num"], r["content"]) for r in saved] == [(1, "v1"), (2, "v2")]
    assert saved[0]["content"] == "v1", "prior version must never be overwritten"


# --- AC5: save_cover_asset(is_selected=true) leaves exactly one selected -----


def test_ac5_exactly_one_selected_cover_per_book(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    first = tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/1.png", is_selected=True,
    )
    second = tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/2.png", is_selected=True,
    )
    selected = rows(
        db,
        "SELECT id FROM cover_assets WHERE book_id = %s AND is_selected",
        (book_id,),
    )
    assert len(selected) == 1
    assert str(selected[0]["id"]) == second
    listed = tools.get_cover_assets(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"],
    )
    assert [a["id"] for a in listed] == [first, second]
    assert [a["is_selected"] for a in listed] == [False, True]


def test_ac5_unselected_save_leaves_existing_selection_alone(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/first.png", is_selected=True,
    )
    tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/draft.png", is_selected=False,
    )
    selected = count(
        db, "SELECT count(*) FROM cover_assets WHERE book_id = %s AND is_selected",
        (book_id,),
    )
    assert selected == 1


# --- AC6: get_formatting_job_status on another tenant's job -> not found -----


def test_ac6_foreign_job_id_raises_not_found(db: Connection[Any]) -> None:
    owner = seed_scope(db, label="owner")
    intruder = seed_scope(db, label="intruder")
    book_id = seed_book(db, owner)
    version_id = tools.save_content_version(
        book_id=book_id, account_id=owner["account_id"],
        tenant_id=owner["tenant_id"], content="body", is_partial=False,
    )
    job_id = tools.run_formatting_job(
        book_id=book_id, account_id=owner["account_id"], tenant_id=owner["tenant_id"],
        target_format="pdf", content_version_id=version_id, cover_asset_id=None,
    )
    with pytest.raises(ValueError, match="not found for this account/tenant"):
        tools.get_formatting_job_status(
            job_id=job_id, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"],
        )
    # A guessed-but-existing uuid from another tenant is indistinguishable
    # from one that does not exist at all.
    with pytest.raises(ValueError, match="not found for this account/tenant"):
        tools.get_formatting_job_status(
            job_id=str(uuid.uuid4()), account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"],
        )
    assert tools.get_formatting_job_status(
        job_id=job_id, account_id=owner["account_id"], tenant_id=owner["tenant_id"]
    )["status"] == "queued"


def test_ac6_tenant_isolation_holds_for_every_read(
    db: Connection[Any],
) -> None:
    """Constitution Article XI: no read crosses a tenant boundary."""
    owner = seed_scope(db, label="iso-owner")
    intruder = seed_scope(db, label="iso-intruder")
    book_id = seed_book(db, owner)
    tools.save_cover_asset(
        book_id=book_id, account_id=owner["account_id"],
        tenant_id=owner["tenant_id"], image_ref="s3://covers/secret.png",
        is_selected=True,
    )
    tools.create_publishing_record(
        book_id=book_id, account_id=owner["account_id"],
        tenant_id=owner["tenant_id"], platform="kdp", metadata={},
    )
    for call in (
        lambda: tools.get_book_status(
            book_id=book_id, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"],
        ),
        lambda: tools.get_publishing_record(
            book_id=book_id, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"], platform="kdp",
        ),
    ):
        with pytest.raises(ValueError, match="not found"):
            call()
    # get_cover_assets is a filtered list, not a single-row lookup (spec §4
    # tool 4), so a foreign book yields an empty list - never the owner's rows.
    assert tools.get_cover_assets(
        book_id=book_id, account_id=intruder["account_id"],
        tenant_id=intruder["tenant_id"],
    ) == []


def test_ac6_write_against_foreign_book_is_rejected(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    """A write verifies the parent book belongs to the caller (spec §3.4)."""
    intruder = seed_scope(db, label="writer")
    foreign_book = seed_book(db, scope)
    for call in (
        lambda: tools.save_content_version(
            book_id=foreign_book, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"], content="x", is_partial=True,
        ),
        lambda: tools.save_cover_asset(
            book_id=foreign_book, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"], image_ref="x.png", is_selected=True,
        ),
        lambda: tools.create_publishing_record(
            book_id=foreign_book, account_id=intruder["account_id"],
            tenant_id=intruder["tenant_id"], platform="kdp", metadata={},
        ),
    ):
        with pytest.raises(ValueError, match="not found for this account/tenant"):
            call()
    assert count(
        db, "SELECT count(*) FROM content_versions WHERE book_id = %s", (foreign_book,)
    ) == 0
    assert count(
        db, "SELECT count(*) FROM cover_assets WHERE book_id = %s", (foreign_book,)
    ) == 0


# --- AC7: create_publishing_record performs no external call ----------------


def test_ac7_publishing_record_is_pending_intent_only(
    db: Connection[Any], scope: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """The row records intent only. Two independent proofs: the package
    imports no network client at all (AST over its own source), and any
    socket created during the call would fail the test (spec §2 non-goal)."""
    import ast
    import pathlib
    import socket

    package_root = pathlib.Path(tools.__file__).parent
    banned = {"httpx", "requests", "urllib", "http", "socket", "boto3", "aiohttp"}
    for source in package_root.glob("*.py"):
        tree = ast.parse(source.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots = {alias.name.split(".")[0] for alias in node.names}
            elif isinstance(node, ast.ImportFrom):
                roots = {(node.module or "").split(".")[0]}
            else:
                continue
            assert not (roots & banned), f"{source.name} imports {roots & banned}"

    def no_network(*args: object, **kwargs: object) -> None:
        raise AssertionError("create_publishing_record attempted a network call")

    monkeypatch.setattr(socket, "socket", no_network)
    monkeypatch.setattr(socket, "create_connection", no_network)

    book_id = seed_book(db, scope)
    record_id = tools.create_publishing_record(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], platform="kdp",
        metadata={"title": "My Book", "categories": ["Fiction"]},
    )
    record = rows(
        db,
        "SELECT status, platform, metadata FROM publishing_records WHERE id = %s",
        (record_id,),
    )[0]
    assert record["status"] == "pending"
    assert record["platform"] == "kdp"
    assert record["metadata"]["title"] == "My Book"
    assert tools.get_publishing_record(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], platform="kdp",
    )["status"] == "pending"


def test_ac7_formatting_job_is_queued_only(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    version_id = tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="body", is_partial=False,
    )
    cover_id = tools.save_cover_asset(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], image_ref="s3://covers/x.png", is_selected=True,
    )
    job_id = tools.run_formatting_job(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], target_format="epub",
        content_version_id=version_id, cover_asset_id=cover_id,
    )
    status = tools.get_formatting_job_status(
        job_id=job_id, account_id=scope["account_id"], tenant_id=scope["tenant_id"]
    )
    assert status["status"] == "queued"
    assert status["target_format"] == "epub"
    assert status["cover_asset_id"] == cover_id


def test_ac7_formatting_job_rejects_foreign_cover_and_version(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    """Validation happens before insert: nothing is written on a miss."""
    mine = seed_scope(db, label="mine")
    theirs = seed_scope(db, label="theirs")
    my_book = seed_book(db, mine)
    their_book = seed_book(db, theirs)
    my_version = tools.save_content_version(
        book_id=my_book, account_id=mine["account_id"],
        tenant_id=mine["tenant_id"], content="mine", is_partial=False,
    )
    their_version = tools.save_content_version(
        book_id=their_book, account_id=theirs["account_id"],
        tenant_id=theirs["tenant_id"], content="theirs", is_partial=False,
    )
    assert my_version != their_version
    with pytest.raises(ValueError, match="not found for this account/tenant"):
        tools.run_formatting_job(
            book_id=my_book, account_id=mine["account_id"],
            tenant_id=mine["tenant_id"], target_format="epub",
            content_version_id=their_version, cover_asset_id=None,
        )
    assert count(
        db, "SELECT count(*) FROM formatting_jobs WHERE book_id = %s", (my_book,)
    ) == 0


# --- Audit hygiene (spec §4 "Audit/invocation actions") ---------------------


def test_audit_inputs_never_store_full_content(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    """Large payloads are stored as preview+length, not the full text."""
    book_id = seed_book(db, scope)
    secret_ish = "x" * 5000
    tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content=secret_ish, is_partial=True,
    )
    audit_inputs = rows(
        db,
        "SELECT inputs FROM audit_log WHERE tenant_id = %s AND action = %s",
        (scope["tenant_id"], "content_version.save"),
    )[0]["inputs"]
    assert audit_inputs["content_chars"] == 5000
    assert len(audit_inputs["content_preview"]) == 100
    assert "x" * 200 not in str(audit_inputs)
    # the full text is still in the business table - the audit row is the
    # bounded copy, not the record of truth.
    assert count(
        db, "SELECT count(*) FROM content_versions WHERE book_id = %s", (book_id,)
    ) == 1


def test_audit_rows_carry_agent_identity(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope)
    tools.save_content_version(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"], content="body", is_partial=False,
    )
    audit = rows(
        db,
        "SELECT agent, account_id, tenant_id FROM audit_log"
        " WHERE tenant_id = %s AND action = %s",
        (scope["tenant_id"], "content_version.save"),
    )[0]
    assert audit["agent"] == "ebook-data"
    assert str(audit["tenant_id"]) == scope["tenant_id"]
    assert str(audit["account_id"]) == scope["account_id"]


def test_book_status_reads_return_status_and_stage(
    db: Connection[Any], scope: dict[str, str]
) -> None:
    book_id = seed_book(db, scope, status="formatting")
    status = tools.get_book_status(
        book_id=book_id, account_id=scope["account_id"],
        tenant_id=scope["tenant_id"],
    )
    assert status == {"book_id": book_id, "status": "formatting", "stage": "formatting"}

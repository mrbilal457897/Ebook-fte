"""Slice 003 AC1/AC2/AC5/AC6 — tool-surface isolation and honesty across the
wired specialist roster.

These are structural guarantees, not transactional ones, so they are proven
against the built agent objects and the prompt/instruction text. No database is
involved, and none is used: the criteria are about *what a toolset contains*
and *what a description claims*, neither of which a database can falsify.

What each criterion is defending:

- **AC1** every allowlist is a subset of the server's 8 tools, and the four
  allowlists are pairwise disjoint. Principle 6 / AGENTS.md §7.3: narrow tools
  over broad ones. A specialist that can read another specialist's table is a
  tenant-isolation bug waiting to be described as a feature.
- **AC2** the toolset actually handed to the model is the allowlist — a
  `tool_filter` that is computed wrongly would otherwise pass AC1 while
  exposing everything.
- **AC5** descriptions and instructions claim only real capability. An
  over-claiming description is exactly the failure this exists to prevent, and
  it is invisible in a code review because it lives in prose.
- **AC6** no module derives `tenant_id`/`account_id` from anything but its
  arguments.
"""

from __future__ import annotations

import ast
import pathlib

import pytest
from content_agent.bookdata import CONTENT_AGENT_TOOLS
from cover_design_agent.agent import build_cover_design_agent
from cover_design_agent.bookdata import COVER_AGENT_TOOLS
from formatting_agent.agent import build_formatting_agent
from formatting_agent.bookdata import FORMATTING_AGENT_TOOLS
from publishing_advisor_agent.agent import build_publishing_advisor_agent
from publishing_advisor_agent.bookdata import PUBLISHING_ADVISOR_TOOLS

# The server's complete tool surface, mirrored from
# mcp-servers/ebook-data/src/ebook_data/tools.py (slice 002 §2, AC1 there
# asserts the live server exposes exactly these). Duplicated deliberately: this
# test must fail if an allowlist ever names a tool the server does not have,
# which is a different failure from the server growing a tool.
SERVER_TOOLS: frozenset[str] = frozenset(
    {
        "save_content_version",
        "get_book_status",
        "save_cover_asset",
        "get_cover_assets",
        "run_formatting_job",
        "get_formatting_job_status",
        "create_publishing_record",
        "get_publishing_record",
    }
)

ALLOWLISTS: dict[str, frozenset[str]] = {
    "content_agent": CONTENT_AGENT_TOOLS,
    "cover_design_agent": COVER_AGENT_TOOLS,
    "formatting_agent": FORMATTING_AGENT_TOOLS,
    "publishing_advisor_agent": PUBLISHING_ADVISOR_TOOLS,
}

# Each tool belongs to exactly one specialist's table. Asserting membership here
# is what makes the disjointness below meaningful rather than coincidental.
TOOL_OWNER: dict[str, str] = {
    "save_content_version": "content_agent",
    "get_cover_assets": "cover_design_agent",
    "save_cover_asset": "cover_design_agent",
    "run_formatting_job": "formatting_agent",
    "get_formatting_job_status": "formatting_agent",
    "create_publishing_record": "publishing_advisor_agent",
    "get_publishing_record": "publishing_advisor_agent",
    # `get_book_status` is the one deliberate overlap: every specialist needs to
    # know what stage the book is at before acting on it. It is a read of the
    # caller's own book, already tenant-scoped, and grants no write access to
    # another specialist's table.
    "get_book_status": "*",
}

AGENT_SOURCE_ROOTS: dict[str, pathlib.Path] = {
    "cover_design_agent": pathlib.Path(
        pathlib.Path(__file__).resolve().parents[2]
        / "cover-design-agent"
        / "src"
        / "cover_design_agent"
    ),
    "formatting_agent": pathlib.Path(
        pathlib.Path(__file__).resolve().parents[2]
        / "formatting-agent"
        / "src"
        / "formatting_agent"
    ),
    "publishing_advisor_agent": pathlib.Path(
        pathlib.Path(__file__).resolve().parents[2]
        / "publishing-advisor-agent"
        / "src"
        / "publishing_advisor_agent"
    ),
}


def _tool_filter(toolset: object) -> list[str]:
    """The `tool_filter` a built `McpToolset` will hand to the model.

    Read off the constructed object rather than off the allowlist constant, so
    a `bookdata.py` that builds the toolset with the wrong filter fails here
    instead of passing on the strength of the constant it did not use.
    """
    filter_value = getattr(toolset, "tool_filter", None)
    assert filter_value is not None, (
        "McpToolset was built with no tool_filter — every tool on the server "
        "would be exposed to the model (Constitution Article IV.6)"
    )
    return sorted(filter_value)


# --- AC1 ------------------------------------------------------------------


@pytest.mark.parametrize("agent_name", sorted(ALLOWLISTS))
def test_every_allowlisted_tool_exists_on_the_server(agent_name: str) -> None:
    unknown = ALLOWLISTS[agent_name] - SERVER_TOOLS
    assert not unknown, (
        f"{agent_name} allowlists {sorted(unknown)}, which the ebook-data "
        f"server does not expose — a filter naming a nonexistent tool silently "
        f"yields an empty toolset at runtime"
    )


def test_allowlists_are_pairwise_disjoint_apart_from_the_shared_status_read() -> None:
    names = sorted(ALLOWLISTS)
    overlaps: list[str] = []
    for i, left in enumerate(names):
        for right in names[i + 1 :]:
            shared = ALLOWLISTS[left] & ALLOWLISTS[right]
            # `get_book_status` is the documented, intended exception; anything
            # else shared means one specialist can act on another's data.
            unexpected = shared - {"get_book_status"}
            if unexpected:
                overlaps.append(f"{left}/{right} share {sorted(unexpected)}")
    assert not overlaps, (
        "specialist tool allowlists overlap on tools that are not the shared "
        f"status read: {overlaps}"
    )


@pytest.mark.parametrize("agent_name", sorted(ALLOWLISTS))
def test_no_allowlist_reaches_another_specialists_table(agent_name: str) -> None:
    foreign = {
        tool
        for tool in ALLOWLISTS[agent_name]
        if TOOL_OWNER.get(tool) not in (agent_name, "*")
    }
    assert not foreign, (
        f"{agent_name} can reach {sorted(foreign)}, which belong to another "
        f"specialist"
    )


def test_allowlists_cover_every_server_tool_exactly_once() -> None:
    """No tool on the server is unreachable, and none is orphaned.

    An orphaned tool is not a bug by itself — `get_book_status` is shared — but
    a tool no specialist can reach usually means a wiring mistake somewhere, so
    the set is asserted rather than assumed.
    """
    reachable: set[str] = set().union(*ALLOWLISTS.values())
    assert reachable == SERVER_TOOLS, (
        f"unreachable server tools: {sorted(SERVER_TOOLS - reachable)}; "
        f"allowlisted but nonexistent: {sorted(reachable - SERVER_TOOLS)}"
    )


# --- AC2 ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("builder", "expected"),
    [
        (build_cover_design_agent, COVER_AGENT_TOOLS),
        (build_formatting_agent, FORMATTING_AGENT_TOOLS),
        (build_publishing_advisor_agent, PUBLISHING_ADVISOR_TOOLS),
    ],
    ids=["cover", "formatting", "publishing"],
)
def test_attached_toolset_is_exactly_the_allowlist(builder: object, expected: frozenset[str]) -> None:
    agent = builder()  # type: ignore[operator]
    tools = list(agent.tools)
    assert len(tools) == 1, f"expected one toolset, got {len(tools)}"
    assert _tool_filter(tools[0]) == sorted(expected)


@pytest.mark.parametrize(
    "builder",
    [build_cover_design_agent, build_formatting_agent, build_publishing_advisor_agent],
    ids=["cover", "formatting", "publishing"],
)
def test_toolset_is_optional(builder: object) -> None:
    assert list(builder(with_book_data_tools=False).tools) == []  # type: ignore[operator]


def test_content_agent_still_loses_its_toolset_while_streaming() -> None:
    """Slice 002 §7.2 must survive the roster change: during a stream the
    Orchestrator owns the write transaction, so a second writer on the same
    `content_versions` row would race it."""
    from content_agent.agent import build_content_agent

    assert list(build_content_agent(with_book_data_tools=False).tools) == []
    assert len(list(build_content_agent().tools)) == 1


# --- AC5 ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("builder", "forbidden", "required"),
    [
        (
            build_cover_design_agent,
            ("generates cover images", "creates cover images", "produces cover images"),
            "does not generate cover images",
        ),
        (
            build_formatting_agent,
            ("produces the file", "produces the finished file", "creates the file"),
            "does not produce the finished file",
        ),
        (
            build_publishing_advisor_agent,
            ("submits to", "publishes the book", "submits the book"),
            "does not submit to any platform",
        ),
    ],
    ids=["cover", "formatting", "publishing"],
)
def test_description_never_overclaims(
    builder: object, forbidden: tuple[str, ...], required: str
) -> None:
    """The description is what the Orchestrator routes on, so an over-claim here
    is a routing bug, not just a documentation one."""
    description = (builder().description or "").lower()  # type: ignore[operator]
    for phrase in forbidden:
        assert phrase not in description, (
            f"description claims it can {phrase!r} — no such tool exists "
            f"(specs/003-specialist-roster/spec.md §3)"
        )
    assert required in description, (
        f"description should carry an explicit negative capability, missing "
        f"{required!r}"
    )


@pytest.mark.parametrize(
    ("builder", "marker"),
    [
        (build_cover_design_agent, "You cannot generate cover images."),
        (build_formatting_agent, "You cannot produce a book file."),
        (build_publishing_advisor_agent, "You cannot submit a book to any platform,"),
    ],
    ids=["cover", "formatting", "publishing"],
)
def test_instructions_disclaim_the_unbuilt_external_action(
    builder: object, marker: str
) -> None:
    assert marker in (builder().instruction or "")  # type: ignore[operator]


# --- AC6 ------------------------------------------------------------------


def _tenant_id_derivation_calls(tree: ast.AST) -> list[str]:
    """Every place a module mentions a tenant/account scope outside a plain
    function argument.

    A tool that accepted `tenant_id` as a parameter and passed it straight
    through is correct — that is exactly the contract in slice 002. What must
    not appear is a *derived* value: a lookup, a comprehension, a regex, an env
    read, a parse of free text. Flagging only calls (not the parameter name
    itself) is what keeps this from failing on every correct file.
    """
    offenders: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = getattr(func, "id", None) or getattr(func, "attr", None)
        if name in ("get", "getenv", "environ", "search", "match", "findall"):
            for arg in node.args:
                if (
                    isinstance(arg, ast.Constant)
                    and isinstance(arg.value, str)
                    and ("tenant" in arg.value.lower() or "account_id" in arg.value.lower())
                ):
                    offenders.append(f"line {node.lineno}: {name}({arg.value!r})")
    return offenders


@pytest.mark.parametrize("package", sorted(AGENT_SOURCE_ROOTS))
def test_no_module_derives_tenant_scope(package: str) -> None:
    root = AGENT_SOURCE_ROOTS[package]
    modules = sorted(root.glob("*.py"))
    assert modules, f"no source found for {package} at {root}"
    for path in modules:
        offenders = _tenant_id_derivation_calls(ast.parse(path.read_text(encoding="utf-8")))
        assert not offenders, f"{path.name} derives tenant scope: {offenders}"

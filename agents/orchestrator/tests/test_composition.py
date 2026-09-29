"""T018 / slice 003 AC3/AC4 — Orchestrator composition: ordinance + sub-agent
wiring.

Pins that the composition matches the ratified
`specs/001-free-tier-content-generation/contracts/orchestrator-prompt.md`:
  - the instruction is the ratified system prompt (streaming relay + the
    available-specialist scoping, FR-004/FR-005),
  - every wired specialist is attached as a sub-agent, built fresh,
  - the prompt names only specialists that exist, and the single-specialist
    special case from slice 001 is gone (slice 003 AC4).
"""

import pytest

from orchestrator.agent import build_orchestrator, orchestrator
from orchestrator.instructions import SYSTEM_PROMPT

WIRED = [
    "content_agent",
    "cover_design_agent",
    "formatting_agent",
    "publishing_advisor_agent",
]


def test_instruction_is_the_ratified_system_prompt() -> None:
    assert orchestrator.instruction == SYSTEM_PROMPT
    assert "relay each chunk the moment" in SYSTEM_PROMPT
    assert "Never invent content" in SYSTEM_PROMPT


def test_single_specialist_special_case_is_gone() -> None:
    """Slice 003 AC4. The slice-001 prompt had a paragraph explaining that only
    one specialist existed; that is now false, and leaving it would have the
    Orchestrator telling customers that cover and export work is unavailable
    while routing them to the agents that do it."""
    assert "only the Content Agent is wired" not in SYSTEM_PROMPT


@pytest.mark.parametrize("name", WIRED)
def test_every_wired_specialist_is_attached(name: str) -> None:
    assert name in [a.name for a in orchestrator.sub_agents], (
        f"{name} is wired in agent.py but not attached to the Orchestrator"
    )


def test_exactly_the_four_wired_specialists_are_attached() -> None:
    """AC3. Not "at least" — an extra sub-agent means routing the Orchestrator
    can reach, and an unreachable-but-routable specialist is the exact failure
    slice 003 exists to prevent."""
    assert [a.name for a in orchestrator.sub_agents] == WIRED


def test_unbacked_specialists_are_not_attached() -> None:
    """Marketing/Ads, Voice, and Support have no tool backing their capability
    (specs/003-specialist-roster/spec.md §2). Attaching them would let the
    Orchestrator route to an agent that can only talk."""
    names = {a.name for a in orchestrator.sub_agents}
    for absent in ("marketing_ads_agent", "voice_agent", "support_chatbot_agent"):
        assert absent not in names


def test_each_specialist_has_a_routable_description() -> None:
    """The Orchestrator routes on `description`, so an empty one is a
    specialist it can never find."""
    for agent in orchestrator.sub_agents:
        assert agent.description and len(agent.description) > 20, (
            f"{agent.name} has no usable description to route on"
        )


def test_building_twice_does_not_raise() -> None:
    """AC3. ADK assigns a sub-agent's parent on composition, so a shared
    instance would fail the second parent build with 'Agent already has a parent
    agent'. This is the bug the `build_*` factories exist to prevent, and it
    only shows up on the *second* call — so a test that builds once cannot
    catch it."""
    first = build_orchestrator()
    second = build_orchestrator()
    assert [a.name for a in first.sub_agents] == [a.name for a in second.sub_agents]


def test_ratified_markers_present() -> None:
    assert "## Streaming content" in SYSTEM_PROMPT
    assert "## Available specialists" in SYSTEM_PROMPT
    assert "## Not available yet" in SYSTEM_PROMPT
    assert "are coming soon" in SYSTEM_PROMPT or "not available yet" in SYSTEM_PROMPT


@pytest.mark.parametrize(
    ("name", "display"),
    [
        ("content_agent", "Content Agent"),
        ("cover_design_agent", "Cover Design Agent"),
        ("formatting_agent", "Formatting Agent"),
        ("publishing_advisor_agent", "Publishing Advisor Agent"),
    ],
)
def test_prompt_names_each_wired_specialist(name: str, display: str) -> None:
    """AC4 — the prompt and the composition must not drift. A specialist
    attached but unnamed in the routing section is one the Orchestrator has
    never been told about."""
    assert display in SYSTEM_PROMPT, f"{name} is attached but absent from the prompt"

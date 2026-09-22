"""T018 — Orchestrator composition: ordinance + sub-agent wiring.

Pins that the composition matches the RATIFIED contracts/orchestrator-prompt.md:
  - the instruction is the ratified system prompt (streaming relay + only the
    Content Agent is a routed specialist this slice; FR-004/FR-005),
  - the Content Agent is attached as a sub-agent (FR-003 routing),
  - no other specialist ships yet (their routing is "coming soon" in-prompt).
"""

from orchestrator.agent import orchestrator
from orchestrator.instructions import SYSTEM_PROMPT


def test_instruction_is_the_ratified_system_prompt() -> None:
    assert orchestrator.instruction == SYSTEM_PROMPT
    assert "relay each chunk the moment" in SYSTEM_PROMPT
    assert "Never invent content" in SYSTEM_PROMPT
    assert "only the Content Agent is wired up" in SYSTEM_PROMPT


def test_content_agent_is_the_only_wired_sub_agent() -> None:
    wired = [a for a in orchestrator.sub_agents]
    assert len(wired) == 1, "exactly one specialist may be wired in this slice"
    assert wired[0].name == "content_agent"
    assert "cover" in wired[0].description.lower() or "book text" in wired[0].description.lower()


def test_ratified_markers_present() -> None:
    assert "## Streaming content" in SYSTEM_PROMPT
    assert "are coming soon" in SYSTEM_PROMPT
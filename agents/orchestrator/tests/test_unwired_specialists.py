"""Slice 003 §3 honesty, extended to the three UNWIRED specialists.

specs/003-specialist-roster/spec.md §3 requires that no agent describe a
capability it cannot perform, and that its instructions carry an explicit
"not available yet" clause. That was implemented for the four *wired*
specialists. The Marketing/Ads, Voice, and Support/Onboarding agents were left
out — and all three shipped descriptions claiming exactly what
specs/003-specialist-roster/spec.md §3 calls the failure mode the slice exists
to prevent ("creates ad campaigns", "Generates audiobook narration",
"escalates to human support") while having no tools at all.

These tests are the guard, so the gap cannot reopen silently. An unwired agent
has no tools, so the bar is absolute: its description must say so, and its
instructions must not present an unbuilt tool as callable.
"""

from __future__ import annotations

import pathlib

import pytest
from google.adk.agents import LlmAgent
from marketing_ads_agent.agent import marketing_ads_agent
from marketing_ads_agent.instructions import MARKETING_ADS_AGENT_INSTRUCTIONS
from support_chatbot_agent.agent import support_chatbot_agent
from support_chatbot_agent.instructions import SUPPORT_CHATBOT_AGENT_INSTRUCTIONS
from voice_agent.agent import voice_agent
from voice_agent.instructions import VOICE_AGENT_INSTRUCTIONS

UNWIRED: dict[str, LlmAgent] = {
    "marketing_ads_agent": marketing_ads_agent,
    "voice_agent": voice_agent,
    "support_chatbot_agent": support_chatbot_agent,
}

INSTRUCTIONS: dict[str, str] = {
    "marketing_ads_agent": MARKETING_ADS_AGENT_INSTRUCTIONS,
    "voice_agent": VOICE_AGENT_INSTRUCTIONS,
    "support_chatbot_agent": SUPPORT_CHATBOT_AGENT_INSTRUCTIONS,
}

# Words that only make sense as a claim of a working capability.
CAPABILITY_CLAIMS = (
    "creates ad campaigns",
    "generates audiobook",
    "escalates to human support",
    "creates a campaign on",
    "produce the resulting audio",
)


def test_these_three_are_actually_unwired() -> None:
    """Precondition for everything below: they are placeholders with no tools.

    If one of these ever gains a toolset, the honest-description requirement
    flips — a wired agent describes its real (narrow) capability — and this test
    fails loudly so the rest of the file gets re-read rather than silently
    becoming wrong.
    """
    for name, agent in UNWIRED.items():
        assert not getattr(agent, "tools", None), (
            f"{name} now has tools; update the honesty assertions in "
            "test_unwired_specialists.py to match its real capability"
        )


@pytest.mark.parametrize("name", sorted(UNWIRED))
def test_description_says_it_is_unwired(name: str) -> None:
    description = (UNWIRED[name].description or "").lower()
    assert "unwired placeholder" in description, (
        f"{name} is not attached to the Orchestrator and has no tools, so its "
        f"description (which the Orchestrator would route on) must say so; "
        f"got: {description!r}"
    )


@pytest.mark.parametrize("name", sorted(UNWIRED))
def test_description_makes_no_capability_claim(name: str) -> None:
    description = (UNWIRED[name].description or "").lower()
    for claim in CAPABILITY_CLAIMS:
        assert claim not in description, (
            f"{name} cannot {claim!r} — it has no tools — so its description "
            "must not claim it"
        )


@pytest.mark.parametrize("name", sorted(UNWIRED))
def test_instructions_disclaim_every_tool(name: str) -> None:
    """The prompt itself must not hand the model a menu of tools that do not
    exist, or it will call them."""
    text = INSTRUCTIONS[name]
    assert "no tools" in text.lower(), f"{name} instructions must state it has no tools"
    assert "not available" in text.lower(), (
        f"{name} instructions must mark its unbuilt tools as NOT AVAILABLE"
    )


@pytest.mark.parametrize("name", sorted(UNWIRED))
def test_instructions_refuse_the_capability_claim(name: str) -> None:
    text = INSTRUCTIONS[name].lower()
    assert "must never claim" in text or "never claim" in text, (
        f"{name} instructions must forbid claiming to have done the work it "
        "cannot do"
    )


def test_the_three_placeholders_are_not_attached_to_the_orchestrator() -> None:
    """Mirrors the slice-003 assertion, kept here so the honesty file stands on
    its own: the Orchestrator must not be routing to an agent with no tools."""
    from orchestrator.agent import build_orchestrator

    names = {a.name for a in build_orchestrator().sub_agents}
    for absent in UNWIRED:
        assert absent not in names, (
            f"{absent} is a placeholder with no tools and must not be attached "
            "until its backing tools exist"
        )


def test_every_agent_package_description_is_not_the_scaffold_default() -> None:
    """`uv init` writes `description = "Add your description here"` into every
    pyproject. A leftover one is harmless but signals the package was never
    looked at; this is the cheap sweep that keeps that honest."""
    repo = pathlib.Path(__file__).resolve().parents[3]
    offenders = [
        str(p.relative_to(repo))
        for p in (repo / "agents").glob("*/pyproject.toml")
        if 'description = "Add your description here"' in p.read_text(encoding="utf-8")
    ]
    assert not offenders, f"scaffold description left in: {offenders}"
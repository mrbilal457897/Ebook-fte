import os

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm

from publishing_advisor_agent.bookdata import build_book_data_toolset
from publishing_advisor_agent.instructions import PUBLISHING_ADVISOR_AGENT_INSTRUCTIONS


def build_publishing_advisor_agent(
    *, model: str | BaseLlm | None = None, with_book_data_tools: bool = True
) -> LlmAgent:
    """Fresh Publishing Advisor Agent instance.

    `model` overrides the configured model name for per-request runs.
    ADK assigns the parent on composition, so a sub-agent must be built fresh
    per Orchestrator build — a module-level singleton (as this file previously
    exported) fails the second parent build with "Agent already has a parent
    agent".

    `with_book_data_tools=False` builds the agent with no tools. Reserved for a
    caller that already owns the write transaction; the Orchestrator does not
    use it for this agent, which is never on the streaming path.
    """
    return LlmAgent(
        name="publishing_advisor_agent",
        instruction=PUBLISHING_ADVISOR_AGENT_INSTRUCTIONS,
        model=model
        or os.getenv("PUBLISHING_ADVISOR_AGENT_MODEL", "gemini-flash-latest"),
        description=(
            "Advises on publishing-platform requirements (KDP, Apple Books, "
            "IngramSpark, Draft2Digital) and records the customer's publishing "
            "intent and submission status for a book. Does not submit to any "
            "platform."
        ),
        tools=[build_book_data_toolset()] if with_book_data_tools else [],
    )

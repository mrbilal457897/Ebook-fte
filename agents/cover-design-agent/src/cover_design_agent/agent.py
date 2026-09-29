import os

from google.adk.agents import LlmAgent

from cover_design_agent.bookdata import build_book_data_toolset
from cover_design_agent.instructions import COVER_DESIGN_AGENT_INSTRUCTIONS


def build_cover_design_agent(
    *, model: str | None = None, with_book_data_tools: bool = True
) -> LlmAgent:
    """Fresh Cover Design Agent instance.

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
        name="cover_design_agent",
        instruction=COVER_DESIGN_AGENT_INSTRUCTIONS,
        model=model or os.getenv("COVER_DESIGN_AGENT_MODEL", "gemini-flash-latest"),
        description=(
            "Reviews and manages a book's cover choices: lists the cover "
            "variants already produced and records the customer's chosen one. "
            "Does not generate cover images."
        ),
        tools=[build_book_data_toolset()] if with_book_data_tools else [],
    )

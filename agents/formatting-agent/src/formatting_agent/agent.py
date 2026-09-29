import os

from google.adk.agents import LlmAgent

from formatting_agent.bookdata import build_book_data_toolset
from formatting_agent.instructions import FORMATTING_AGENT_INSTRUCTIONS


def build_formatting_agent(
    *, model: str | None = None, with_book_data_tools: bool = True
) -> LlmAgent:
    """Fresh Formatting Agent instance.

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
        name="formatting_agent",
        instruction=FORMATTING_AGENT_INSTRUCTIONS,
        model=model or os.getenv("FORMATTING_AGENT_MODEL", "gemini-flash-latest"),
        description=(
            "Prepares a book's export: checks its status, starts an EPUB/MOBI/"
            "PDF formatting job, and reports that job's progress. Does not "
            "produce the finished file."
        ),
        tools=[build_book_data_toolset()] if with_book_data_tools else [],
    )

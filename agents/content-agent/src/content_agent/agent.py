import os

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm

from content_agent.bookdata import build_book_data_toolset
from content_agent.instructions import CONTENT_AGENT_INSTRUCTIONS


def build_content_agent(
    *, model: str | BaseLlm | None = None, with_book_data_tools: bool = True
) -> LlmAgent:
    """Fresh Content Agent instance (single source; T018 wiring).

    `model` overrides the configured model for per-request runs, and accepts
    either a model name or a constructed ADK model object. The object form is
    how a BYOK generation reaches the agent that actually writes the book: the
    Orchestrator passes the same per-request model it uses for itself, so the
    customer's key bills the generation and not just the routing token
    (FR-008, Principle 2).

    ADK assigns the parent on composition, so the sub-agent must be built
    fresh per Orchestrator build — never reuse the module singleton as a
    sub-agent across two parent builds.

    `with_book_data_tools=False` builds the agent with no tools. The streaming
    path needs that: while tokens are streaming, the Orchestrator owns the
    write transaction because it must renew the in-flight lease in the same
    commit (specs/002-ebook-data-mcp/spec.md §7.2), and a second writer
    appending to the same `content_versions` row would race it. The toolset is
    for the discrete, non-streaming writes instead.
    """
    return LlmAgent(
        name="content_agent",
        instruction=CONTENT_AGENT_INSTRUCTIONS,
        model=model or os.getenv("CONTENT_AGENT_MODEL", "gemini-flash-latest"),
        description=(
            "Generates and edits book text: chapters, outlines, tone/voice "
            "adjustments, and revisions."
        ),
        tools=[build_book_data_toolset()] if with_book_data_tools else [],
    )


content_agent = build_content_agent()

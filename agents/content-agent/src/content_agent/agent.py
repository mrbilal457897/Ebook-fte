import os

from google.adk.agents import LlmAgent

from content_agent.instructions import CONTENT_AGENT_INSTRUCTIONS


def build_content_agent(*, model: str | None = None) -> LlmAgent:
    """Fresh Content Agent instance (single source; T018 wiring).

    `model` overrides the configured model name for per-request runs.
    ADK assigns the parent on composition, so the sub-agent must be built
    fresh per Orchestrator build — never reuse the module singleton as a
    sub-agent across two parent builds.
    """
    return LlmAgent(
        name="content_agent",
        instruction=CONTENT_AGENT_INSTRUCTIONS,
        model=model or os.getenv("CONTENT_AGENT_MODEL", "gemini-flash-latest"),
        description=(
            "Generates and edits book text: chapters, outlines, tone/voice "
            "adjustments, and revisions."
        ),
    )


content_agent = build_content_agent()
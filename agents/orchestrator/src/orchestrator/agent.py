import os

from content_agent.agent import build_content_agent
from google.adk.agents import LlmAgent

from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS


def build_orchestrator(
    *, model: str | None = None, streaming: bool = False
) -> LlmAgent:
    """Single-source Orchestrator composition (T018).

    `model` overrides the configured model name for a per-request run
    (BYOK resolution in byok.py feeds this). The default builds from env.
    A fresh Content Agent is built for every call: ADK parents the
    sub-agent on composition, so a shared singleton would fail a second
    parent build with "Agent already has a parent agent".

    `streaming=True` builds the Content Agent without its ebook-data toolset.
    During a stream the Orchestrator holds the write transaction (it renews the
    in-flight lease in the same commit), so a second writer on the same
    `content_versions` row would race it — see specs/002-ebook-data-mcp/spec.md
    §7.2 and the `with_book_data_tools` docstring in the Content Agent.
    """
    return LlmAgent(
        name="orchestrator",
        instruction=ORCHESTRATOR_INSTRUCTIONS,
        model=model or os.getenv("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
        sub_agents=[build_content_agent(with_book_data_tools=not streaming)],
        description=(
            "Routes end-customer requests to the right specialist agent "
            "for the E-book Digital FTE and relays its output as a stream. "
            "Wired specialists in this deployment: Content Agent."
        ),
    )


orchestrator = build_orchestrator()

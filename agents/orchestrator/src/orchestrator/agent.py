import os

from content_agent.agent import build_content_agent
from cover_design_agent.agent import build_cover_design_agent
from formatting_agent.agent import build_formatting_agent
from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from publishing_advisor_agent.agent import build_publishing_advisor_agent

from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS

#: What `model` accepts: a model *name* (resolved from env by ADK) or a fully
#: constructed ADK model object. The object form is what makes BYOK possible —
#: it is how a customer's own key travels with the run instead of ADK picking
#: up the process-wide `GOOGLE_API_KEY` (FR-008, Principle 2).
type ModelSpec = str | BaseLlm


def build_orchestrator(
    *, model: ModelSpec | None = None, streaming: bool = False
) -> LlmAgent:
    """Single-source Orchestrator composition (T018).

    `model` overrides the configured model for a per-request run. It accepts
    either a model name or a constructed ADK model object (a BYOK spec from
    `byok.build_model`), and `None` means "use the configured default". Every
    specialist is built fresh for every call: ADK parents the sub-agent on
    composition, so a shared singleton would fail a second parent build with
    "Agent already has a parent agent". That is why these are `build_*`
    factories and not module-level agents.

    **`model` is passed down to the Content Agent as well as the Orchestrator.**
    The Orchestrator mostly routes; the Content Agent is what actually writes
    the customer's book. Setting it only on the Orchestrator would leave the
    generation itself running on the platform key while the router ran on the
    customer's — the customer's key would be billed for a token of routing and
    nothing else. The other three specialists take no request-scoped model:
    they are dispatch-only in this deployment and default to their configured
    names.

    `streaming=True` builds the Content Agent without its ebook-data toolset.
    During a stream the Orchestrator holds the write transaction (it renews the
    in-flight lease in the same commit), so a second writer on the same
    `content_versions` row would race it — see specs/002-ebook-data-mcp/spec.md
    §7.2 and the `with_book_data_tools` docstring in the Content Agent. The
    other three specialists are never on that path, so they always get theirs.

    Which specialists are attached, and what each may actually do, is specified
    in specs/003-specialist-roster/spec.md §2–§3. In particular the Marketing/
    Ads, Voice, and Support specialists are NOT attached: no tool backing their
    capability exists yet, and wiring an agent that cannot do its job would
    violate the ratified prompt rule against pretending (see the prompt's
    "Available specialists" section).
    """
    return LlmAgent(
        name="orchestrator",
        instruction=ORCHESTRATOR_INSTRUCTIONS,
        model=model or os.getenv("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
        sub_agents=[
            build_content_agent(model=model, with_book_data_tools=not streaming),
            build_cover_design_agent(),
            build_formatting_agent(),
            build_publishing_advisor_agent(),
        ],
        description=(
            "Routes end-customer requests to the right specialist agent "
            "for the E-book Digital FTE and relays its output as a stream. "
            "Wired specialists in this deployment: Content Agent, Cover Design "
            "Agent, Formatting Agent, Publishing Advisor Agent."
        ),
    )


orchestrator = build_orchestrator()

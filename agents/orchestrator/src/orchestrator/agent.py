import os

from google.adk.agents import LlmAgent

from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS

orchestrator = LlmAgent(
    name="orchestrator",
    instruction=ORCHESTRATOR_INSTRUCTIONS,
    model=os.getenv("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
    description=(
        "Routes end-customer requests to the right specialist agent "
        "for the E-book Digital FTE."
    ),
)
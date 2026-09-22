import os

from content_agent.agent import content_agent as content_agent_sub
from google.adk.agents import LlmAgent

from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS

orchestrator = LlmAgent(
    name="orchestrator",
    instruction=ORCHESTRATOR_INSTRUCTIONS,
    model=os.getenv("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
    sub_agents=[content_agent_sub],
    description=(
        "Routes end-customer requests to the right specialist agent "
        "for the E-book Digital FTE and relays its output as a stream. "
        "Wired specialists in this deployment: Content Agent."
    ),
)
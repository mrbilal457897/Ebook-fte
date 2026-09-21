import os

from google.adk.agents import LlmAgent

from cover_design_agent.instructions import COVER_DESIGN_AGENT_INSTRUCTIONS

cover_design_agent = LlmAgent(
    name="cover_design_agent",
    instruction=COVER_DESIGN_AGENT_INSTRUCTIONS,
    model=os.getenv("COVER_DESIGN_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Produces book cover concepts and variants, and persists them "
        "for the customer."
    ),
)
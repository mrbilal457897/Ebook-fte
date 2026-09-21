import os

from google.adk.agents import LlmAgent

from formatting_agent.instructions import FORMATTING_AGENT_INSTRUCTIONS

formatting_agent = LlmAgent(
    name="formatting_agent",
    instruction=FORMATTING_AGENT_INSTRUCTIONS,
    model=os.getenv("FORMATTING_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Turns finished content and a chosen cover into properly sized, "
        "exportable book files."
    ),
)
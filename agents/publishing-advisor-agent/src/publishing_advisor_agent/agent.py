import os

from google.adk.agents import LlmAgent

from publishing_advisor_agent.instructions import PUBLISHING_ADVISOR_AGENT_INSTRUCTIONS

publishing_advisor_agent = LlmAgent(
    name="publishing_advisor_agent",
    instruction=PUBLISHING_ADVISOR_AGENT_INSTRUCTIONS,
    model=os.getenv("PUBLISHING_ADVISOR_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Advises on publishing-platform requirements and submits books "
        "using the customer's own connected credentials."
    ),
)
import os

from google.adk.agents import LlmAgent

from content_agent.instructions import CONTENT_AGENT_INSTRUCTIONS

content_agent = LlmAgent(
    name="content_agent",
    instruction=CONTENT_AGENT_INSTRUCTIONS,
    model=os.getenv("CONTENT_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Generates and edits book text: chapters, outlines, tone/voice "
        "adjustments, and revisions."
    ),
)
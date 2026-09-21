import os

from google.adk.agents import LlmAgent

from voice_agent.instructions import VOICE_AGENT_INSTRUCTIONS

voice_agent = LlmAgent(
    name="voice_agent",
    instruction=VOICE_AGENT_INSTRUCTIONS,
    model=os.getenv("VOICE_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Generates audiobook narration from finished book content "
        "with customer-chosen voice options."
    ),
)
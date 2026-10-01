import os

from google.adk.agents import LlmAgent

from voice_agent.instructions import VOICE_AGENT_INSTRUCTIONS

voice_agent = LlmAgent(
    name="voice_agent",
    instruction=VOICE_AGENT_INSTRUCTIONS,
    model=os.getenv("VOICE_AGENT_MODEL", "gemini-flash-latest"),
    # UNWIRED PLACEHOLDER, same reason as the Marketing/Ads and Support agents:
    # not attached to the Orchestrator, no tools, no `narrations` table and no
    # TTS integration. The previous description claimed it "generates audiobook
    # narration", which specs/003-specialist-roster/spec.md §3 calls out as the
    # exact over-claim that must not ship.
    description=(
        "UNWIRED PLACEHOLDER — not attached to the running Orchestrator and has "
        "no tools. Voice selection and audiobook narration are both "
        "unimplemented; nothing here can run."
    ),
)
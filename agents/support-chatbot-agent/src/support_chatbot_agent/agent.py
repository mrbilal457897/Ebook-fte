import os

from google.adk.agents import LlmAgent

from support_chatbot_agent.instructions import SUPPORT_CHATBOT_AGENT_INSTRUCTIONS

support_chatbot_agent = LlmAgent(
    name="support_chatbot_agent",
    instruction=SUPPORT_CHATBOT_AGENT_INSTRUCTIONS,
    model=os.getenv("SUPPORT_CHATBOT_AGENT_MODEL", "gemini-flash-latest"),
    # UNWIRED PLACEHOLDER, same reason as the Marketing/Ads and Voice agents:
    # not attached to the Orchestrator, no tools. `search_help_library` needs the
    # `documents`/`embeddings` reference library, which is not migrated and has no
    # pgvector extension; `escalate_to_human_support` needs a support desk that
    # does not exist. The previous description implied both work.
    description=(
        "UNWIRED PLACEHOLDER — not attached to the running Orchestrator and has "
        "no tools. Help-library search and human-support escalation are both "
        "unimplemented; nothing here can run."
    ),
)
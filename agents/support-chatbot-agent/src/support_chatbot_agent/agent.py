import os

from google.adk.agents import LlmAgent

from support_chatbot_agent.instructions import SUPPORT_CHATBOT_AGENT_INSTRUCTIONS

support_chatbot_agent = LlmAgent(
    name="support_chatbot_agent",
    instruction=SUPPORT_CHATBOT_AGENT_INSTRUCTIONS,
    model=os.getenv("SUPPORT_CHATBOT_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Onboards and supports first-time customers: explains how to start, "
        "answers process questions, and escalates to human support."
    ),
)
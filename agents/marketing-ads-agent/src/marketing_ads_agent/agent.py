import os

from google.adk.agents import LlmAgent

from marketing_ads_agent.instructions import MARKETING_ADS_AGENT_INSTRUCTIONS

marketing_ads_agent = LlmAgent(
    name="marketing_ads_agent",
    instruction=MARKETING_ADS_AGENT_INSTRUCTIONS,
    model=os.getenv("MARKETING_ADS_AGENT_MODEL", "gemini-flash-latest"),
    description=(
        "Drafts ad copy, suggests targeting, and creates ad campaigns on "
        "the customer's own connected ad account."
    ),
)
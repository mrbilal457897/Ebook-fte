import os

from google.adk.agents import LlmAgent

from marketing_ads_agent.instructions import MARKETING_ADS_AGENT_INSTRUCTIONS

marketing_ads_agent = LlmAgent(
    name="marketing_ads_agent",
    instruction=MARKETING_ADS_AGENT_INSTRUCTIONS,
    model=os.getenv("MARKETING_ADS_AGENT_MODEL", "gemini-flash-latest"),
    # This description is what an Orchestrator would route on, and this agent is
    # NOT attached to the Orchestrator (no tool backs any of its work — there is
    # no ads-platforms MCP server and no `ad_accounts`/`ad_campaigns` tables).
    # The previous text claimed it "creates ad campaigns", which is exactly the
    # over-claiming specs/003-specialist-roster/spec.md §3 forbids. Stated as the
    # unimplemented placeholder it is.
    description=(
        "UNWIRED PLACEHOLDER — not attached to the running Orchestrator and has "
        "no tools. Ad-copy drafting, targeting suggestions, and campaign "
        "creation are all unimplemented; nothing here can run."
    ),
)
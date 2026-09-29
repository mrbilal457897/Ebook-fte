"""One-shot ADK warmup, run at server start rather than on a customer's request.

Measured in T046 (against the project's real remote Postgres, pinned
`google-adk==2.9.2`): the *first* `Runner.run_async` in a process costs ~0.8 s
of ADK-internal work — lazily-built instrumentation, tool/agent config
reflection, session and event plumbing — before a single model byte is
requested. The second run costs ~0.016 s. That 0.8 s was landing entirely on
whichever end-customer happened to be first, inside FR-004's 2 s
time-to-first-token budget.

The fix is to pay it at deploy time instead: run one throwaway ADK turn when
the app starts, discard the output. It costs one trivial model call per process
lifetime, which is cheaper than one customer waiting a third of a second.

Set `ADK_WARMUP=0` to skip it (offline test runs, local development without a
key). A failed warmup is logged and ignored — it is an optimisation, and a
cold first request is still correct, just slower.
"""

import asyncio
import logging
import os

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

WARMUP_PROMPT = "ok"
WARMUP_TIMEOUT_SECONDS = 30.0


def warmup_enabled() -> bool:
    return os.getenv("ADK_WARMUP", "1").strip() not in ("0", "false", "False", "")


async def warm_adk(model: str | None = None) -> bool:
    """Run one discarded ADK turn. Returns whether it completed.

    The agent here is a bare `LlmAgent` with no tools and no sub-agents on
    purpose: warming a different graph than the one production runs would only
    warm part of the path. What it does share with the real request is
    everything expensive — `Runner` construction, the instrumentation stack,
    and the model adapter for `model`.
    """
    agent = LlmAgent(
        name="warmup",
        instruction="Reply with the single character: ok",
        model=model or os.getenv("ORCHESTRATOR_MODEL", "gemini-flash-latest"),
    )
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name="warmup", user_id="warmup", session_id="warmup"
    )
    runner = Runner(agent=agent, app_name="warmup", session_service=session_service)

    async def _drain() -> None:
        async for _event in runner.run_async(
            user_id="warmup",
            session_id="warmup",
            new_message=genai_types.Content(
                role="user", parts=[genai_types.Part(text=WARMUP_PROMPT)]
            ),
        ):
            pass

    try:
        await asyncio.wait_for(_drain(), timeout=WARMUP_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001 — a warmup failure must never block startup
        logger.warning("ADK warmup did not complete (%s); first request pays the cost", exc)
        return False
    logger.info("ADK warmup complete")
    return True

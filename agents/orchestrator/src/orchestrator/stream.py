"""Map ADK runner events to the SSE `token | version | error` wire shapes.

This is the integration seam for the T011 spike facts (pinned
`google-adk==2.9.2`):
  - `event.partial is True` and `event.content` set  -> text delta -> `token`
  - `event.partial is False` and `event.turn_complete is True` -> `version`
  - content parts are genai `Part` objects (.text, not ["text"])
  - `invocation_id` correlates the run to the transplanted business records

This module holds no DB side effects and no lease/audit policy on purpose:
per-chunk persistence (T032), in-flight lease renewal/release (T043), and
the terminal `capability_invocations` + `audit_log` rows in one transaction
(FR-006/AC5) live in the server's streaming loop. This stays a pure mapper
so each concern is testable alone.
"""

from collections.abc import AsyncIterator
from typing import Any

from google.adk.agents._streaming_mode import StreamingMode
from google.adk.agents.run_config import RunConfig
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from orchestrator.agent import orchestrator as orchestrator_agent


def _event_text(event: Any) -> str:
    if not event.content or not event.content.parts:
        return ""
    return "".join(part.text or "" for part in event.content.parts)


async def stream_generation(
    *,
    tenant_id: str,
    account_id: str,
    conversation_id: str,
    book_id: str,
    version_id: str,
    prompt: str,
) -> AsyncIterator[dict[str, Any]]:
    """Run the Orchestrator agent and yield `token` / `version` / `error` dicts.

    Each yielded dict is `{"event": "token", "data": {"delta": ...}}`,
    `{"event": "version", "data": {...}}` (exactly one), or
    `{"event": "error", "data": {...}}` (exactly one, terminal). Callers
    serialize to SSE and attach their own persistence/lease side effects.
    """
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name="orchestrator", user_id=account_id, session_id=conversation_id
    )
    runner = Runner(
        agent=orchestrator_agent,
        app_name="orchestrator",
        session_service=session_service,
    )

    full_text: list[str] = []
    try:
        async for event in runner.run_async(
            user_id=account_id,
            session_id=conversation_id,
            new_message=genai_types.Content(
                role="user", parts=[genai_types.Part(text=prompt)]
            ),
            run_config=RunConfig(streaming_mode=StreamingMode.SSE),
        ):
            if event.partial and event.content:
                delta = _event_text(event)
                if not delta:
                    continue
                full_text.append(delta)
                yield {"event": "token", "data": {"delta": delta}}
            elif not event.partial and event.turn_complete:
                full = _event_text(event) or "".join(full_text)
                if not full:
                    continue
                yield {
                    "event": "version",
                    "data": {
                        "versionId": version_id,
                        "bookId": book_id,
                        "conversationId": conversation_id,
                        "isPartial": False,
                        "fullText": full,
                    },
                }
                return
    except Exception as exc:  # noqa: BLE001 - any provider/transport fault maps to an error event
        yield {
            "event": "error",
            "data": {
                "code": "provider_error",
                "message": str(exc),
                "refunded": False,
            },
        }
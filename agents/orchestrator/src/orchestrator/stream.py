"""Map ADK runner events to the SSE `token | version | error` wire shapes.

This is the integration seam for the T011 spike facts (pinned
`google-adk==2.9.2`):
  - `event.partial is True` and `event.content` set  -> text delta -> `token`
  - `event.partial is False` and `event.turn_complete is True` -> `version`
  - content parts are genai `Part` objects (.text, not ["text"])
  - `invocation_id` correlates the run to the transplanted business records

The mapper stays pure. Persistence / lease renewal / terminal transactions
(FR-005/FR-006, T032/T043) are injected as `on_*` hooks by `server.py`; each
hook runs synchronously BEFORE the corresponding event is yielded, so a
commit that fails propagates into the `error` path instead of after the
customer already saw the token.
"""

import inspect
from collections.abc import AsyncIterator, Callable
from typing import Any

from google.adk.agents._streaming_mode import StreamingMode
from google.adk.agents.run_config import RunConfig
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from orchestrator.agent import build_orchestrator


def _event_text(event: Any) -> str:
    if not event.content or not event.content.parts:
        return ""
    return "".join(part.text or "" for part in event.content.parts)


async def _invoke(hook: Callable[[Any], Any] | None, arg: Any) -> None:
    """Call an `on_*` hook and await it when it is async.

    `server.py` supplies async hooks that commit on a worker thread
    (dbexec.run_blocking); tests supply plain callables. Both are supported, and
    an awaitable result is always awaited before the corresponding event is
    yielded, so FR-005's "commit before the customer sees the token" holds for
    either shape.
    """
    if hook is None:
        return
    result = hook(arg)
    if inspect.isawaitable(result):
        await result


async def stream_generation(
    *,
    tenant_id: str,
    account_id: str,
    conversation_id: str,
    book_id: str,
    version_id: str,
    prompt: str,
    model: str | None = None,
    on_token: Callable[[str], Any] | None = None,
    on_terminal: Callable[[str], Any] | None = None,
    on_failure: Callable[[str], Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Run the Orchestrator agent and yield `token` / `version` / `error` dicts.

    Each yielded dict is `{"event": "token", "data": {"delta": ...}}`,
    `{"event": "version", "data": {...}}` (exactly one), or
    `{"event": "error", "data": {...}}` (exactly one, terminal). A failed
    `on_token`/`on_terminal` hook aborts the run and yields the `error` event
    instead; `on_failure` is invoked before `error` so the server can refund
    + audit + release the lease.

    Hooks may be sync or async; see `_invoke`.
    """
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name="orchestrator", user_id=account_id, session_id=conversation_id
    )
    runner = Runner(
        agent=build_orchestrator(model=model, streaming=True),
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
                if on_token is not None:
                    await _invoke(on_token, delta)
                full_text.append(delta)
                yield {"event": "token", "data": {"delta": delta}}
            elif not event.partial and event.turn_complete:
                full = _event_text(event) or "".join(full_text)
                if not full:
                    continue
                if on_terminal is not None:
                    await _invoke(on_terminal, full)
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
        code = "provider_error"
        if on_failure is not None:
            await _invoke(on_failure, code)
        yield {
            "event": "error",
            "data": {
                "code": code,
                "message": str(exc),
                "refunded": not full_text,
            },
        }

"""T011 spike: verify the exact ADK `Event` field names the SSE relay reads.

research.md §3 flagged "detail to verify at Build time": exact Event field
names for partial text and stream completion on the installed pinned
`google-adk==2.9.2`. The relay (server.py, T017/T018) reads:
  - event.partial is True          -> text delta events
  - event.content.parts[].text     -> the delta string
  - event.partial is False AND
    event.turn_complete is True    -> the terminal event (carries full text)
  - event.invocation_id            -> session/version correlation

Facts verified against the installed ADK (not guessed):
  1. A partial LlmResponse -> an event with `partial=True`, `content` set,
     `turn_complete` unset (None).
  2. A completion LlmResponse ONLY surfaces as an event when it carries
     `content` AND `partial=False` AND `turn_complete=True`. A terminal
     response with no content is dropped by the runner, so the relay must
     always drive terminal chunks with content (real models do this; a fake
     must too).
  3. `event.timestamp` is a float (unix epoch seconds), NOT a string.
  4. `event.content.parts` are genai `Part` objects: read text via
     `part.text` (not `part["text"]`).

This test pins those facts to the installed ADK so the relay never chases a
guessed shape. No network: it drives ADK's runner with a fake `BaseLlm`.
"""

from collections.abc import AsyncGenerator

import pytest
from google.adk.agents import LlmAgent
from google.adk.agents._streaming_mode import StreamingMode
from google.adk.agents.run_config import RunConfig
from google.adk.events import Event
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

pytestmark = pytest.mark.anyio


def _chunk(text: str, *, partial: bool, turn_complete: bool = False) -> genai_types.Content:
    return genai_types.Content(parts=[genai_types.Part(text=text)])


def _event_text(event: Event) -> str:
    """Concatenated text of an event's parts (None-safe)."""
    if not event.content or not event.content.parts:
        return ""
    return "".join(part.text or "" for part in event.content.parts)


class FakeModel(BaseLlm):
    """Streams two partial chunks then a content-carrying terminal chunk,
    like Gemini does (verified: a no-content terminal response is dropped)."""

    model: str = "fake/spike-model"

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        assert stream, "relay always asks for streaming"
        yield LlmResponse(partial=True, content=_chunk("Hello ", partial=True))
        yield LlmResponse(partial=True, content=_chunk("world", partial=True))
        yield LlmResponse(
            partial=False,
            turn_complete=True,
            content=_chunk("Hello world", partial=False),
        )


@pytest.fixture
def agent() -> LlmAgent:
    return LlmAgent(name="spike_agent", model=FakeModel())


async def _collect(agent: LlmAgent) -> list[Event]:
    session_service = InMemorySessionService()
    await session_service.create_session(app_name="spike_test_app", user_id="u1", session_id="s1")
    runner = Runner(agent=agent, app_name="spike_test_app", session_service=session_service)
    events: list[Event] = []
    async for event in runner.run_async(
        user_id="u1",
        session_id="s1",
        new_message=genai_types.Content(role="user", parts=[genai_types.Part(text="go")]),
        run_config=RunConfig(streaming_mode=StreamingMode.SSE),
    ):
        events.append(event)
    return events


async def test_stream_emits_partial_events_with_text_and_terminal(agent: LlmAgent) -> None:
    events = await _collect(agent)

    text_deltas: list[Event] = [e for e in events if e.partial and e.content]
    terminal = [e for e in events if not e.partial and e.turn_complete]

    assert text_deltas, "expected at least one partial text event"
    assert terminal, "expected a terminal content event"
    assert len(terminal) == 1, "expected exactly one terminal event"

    joined = "".join(_event_text(e) for e in text_deltas)
    assert joined == "Hello world"
    # The terminal event carries the full text, not a delta.
    terminal_text = _event_text(terminal[0])
    assert terminal_text == "Hello world"

    # Every event carries the fields the SSE relay depends on.
    for e in events:
        assert isinstance(e.invocation_id, str) and e.invocation_id
        assert isinstance(e.timestamp, float) and e.timestamp > 0
        assert hasattr(e, "content")


async def test_terminal_event_signals_turn_complete(agent: LlmAgent) -> None:
    events = await _collect(agent)
    terminal = [e for e in events if not e.partial and e.turn_complete]
    assert len(terminal) == 1
    # The terminal event is the ONLY non-partial, turn_complete event; partial
    # deltas must never carry a truthy turn_complete (the relay distinguishes
    # token events from the terminal version event by this).
    assert all(not e.turn_complete for e in events if e.partial)


def test_partial_and_content_fields_exist_on_pinned_adk() -> None:
    """Snapshot of the public Event field names present in ADK == 2.9.2."""
    fields = set(Event.model_fields.keys())
    for required in (
        "partial",
        "content",
        "invocation_id",
        "timestamp",
        "turn_complete",
        "author",
        "interaction_id",
    ):
        assert required in fields, f"Event.{required} missing on google-adk==2.9.2"
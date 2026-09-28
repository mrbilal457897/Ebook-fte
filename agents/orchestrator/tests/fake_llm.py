"""A deterministic in-process LLM so admission-path tests never touch a
provider (Constitution Article X: a test that depends on someone else's API
quota is not a test).

`google-adk`'s `LlmAgent` accepts a `BaseLlm` instance, so a lease/gate test
can exercise the real Orchestrator -> Content Agent routing, the real SSE
mapping, and the real persistence path with zero network calls and zero
latency. The streamed text is fixed, which is what those tests need: they
assert *admission and stream shape*, never model quality.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types as genai_types

FIXED_TEXT = "The tide went out and left the harbour sleeping."


class FakeLlm(BaseLlm):
    """Streams FIXED_TEXT, then completes the turn. Never raises."""

    model: str = "fake-llm"

    @classmethod
    def supported_models(cls) -> list[str]:
        return ["fake-llm"]

    def connect(self, llm_request: LlmRequest) -> Any:
        raise NotImplementedError("FakeLlm is stateless; no connection needed")

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        for index in range(0, len(FIXED_TEXT), 12):
            yield LlmResponse(
                content=genai_types.Content(
                    role="model",
                    parts=[genai_types.Part(text=FIXED_TEXT[index : index + 12])],
                ),
                partial=True,
            )
        yield LlmResponse(
            content=genai_types.Content(
                role="model", parts=[genai_types.Part(text=FIXED_TEXT)]
            ),
            turn_complete=True,
        )

    @asynccontextmanager
    async def _noop(self) -> AsyncGenerator[None, None]:
        yield None


class FailingLlm(BaseLlm):
    """Raises on the first call, to exercise the provider-fault path."""

    model: str = "failing-llm"

    @classmethod
    def supported_models(cls) -> list[str]:
        return ["failing-llm"]

    def connect(self, llm_request: LlmRequest) -> Any:
        raise NotImplementedError("FailingLlm is stateless; no connection needed")

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        raise RuntimeError("simulated provider outage")
        yield  # pragma: no cover - unreachable, makes this an async generator


def fake_orchestrator(*, model: str | None = None, streaming: bool = False) -> Any:
    """`build_orchestrator` replacement backed by `FakeLlm`.

    `sub_agents` is empty on purpose: these tests are about the Orchestrator's
    own admission/stream/persistence path, not about specialist routing (which
    test_composition.py and the live tests cover).

    `streaming` is accepted and ignored so this replacement stays signature-
    compatible with the real `build_orchestrator` (the `with_book_data_tools`
    split, T103). Tests that must not accidentally couple to a new argument
    should fail here loudly, not in production.
    """
    from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS

    return LlmAgent(
        name="orchestrator",
        instruction=ORCHESTRATOR_INSTRUCTIONS,
        model=FakeLlm(),
        sub_agents=[],
        description="Deterministic orchestrator used by admission-path tests.",
    )


def failing_orchestrator(*, model: str | None = None, streaming: bool = False) -> Any:
    """`build_orchestrator` replacement whose model always fails.

    Signature-compatible with the real `build_orchestrator` (see
    `fake_orchestrator`).
    """
    from orchestrator.instructions import ORCHESTRATOR_INSTRUCTIONS

    return LlmAgent(
        name="orchestrator",
        instruction=ORCHESTRATOR_INSTRUCTIONS,
        model=FailingLlm(),
        sub_agents=[],
        description="Always-failing orchestrator used by failure-path tests.",
    )

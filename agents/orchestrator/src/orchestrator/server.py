"""Orchestrator HTTP service (FastAPI/uvicorn on :8080 per quickstart).

Only the internal contract lives here (contracts/orchestrator-api.md): the
browser never reaches this service. The Next.js proxy authenticates the user
and presents a short-lived internal token; the Orchestrator derives business
context from the forwarded `accountRef`, never from model text (Article IV.5).

T017 scope: admission gate + JSON pre-stream rejections + SSE endpoint whose
event payloads come from the `stream` mapper. Later tasks layer BYOK
resolution (T031), incremental persistence (T032), lease renewal/release
(T043), and the terminal audit/invocation transaction (FR-006).
"""

import json
import secrets
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from orchestrator import config, gate, models
from orchestrator.stream import stream_generation

MAX_PROMPT_CHARS = 20_000

app = FastAPI(title="E-book FTE Orchestrator", version="0.1.0")

SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
}


class AccountRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenantId: str
    accountId: str


class RateLimitContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deviceKey: str
    clientIpKey: str | None = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str
    accountRef: AccountRef
    modelCredentialId: str | None = Field(default=None)
    conversationId: str
    rateLimitContext: RateLimitContext


class Rejection(Exception):
    def __init__(self, status_code: int, body: dict[str, Any]) -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(str(body))


_REJECT_BODIES: dict[str, tuple[int, dict[str, Any]]] = {
    "rate_limited": (429, {"code": "rate_limited", "message": "Too many requests"}),
    "free_tier_exhausted": (
        402,
        {"code": "free_tier_exhausted", "upgrade": True, "message": "Free generations used up"},
    ),
    "already_in_progress": (
        409,
        {"code": "already_in_progress", "message": "A generation is already in progress"},
    ),
    "invalid_prompt": (400, {"code": "invalid_prompt", "message": "Prompt is empty or too long"}),
}


@app.exception_handler(Rejection)
async def _rejection_handler(_: Request, exc: Rejection) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.body)


def require_internal_token(request: Request) -> None:
    token = config.get_settings().internal_auth_token
    if not token:
        raise Rejection(
            500,
            {"code": "internal", "message": "INTERNAL_AUTH_TOKEN not configured"},
        )
    presented = request.headers.get("X-Internal-Token", "")
    if not secrets.compare_digest(presented, token):
        raise Rejection(401, {"code": "unauthorized", "message": "Bad internal token"})


def _admit_request(
    req: GenerateRequest, prompt: str
) -> gate.GenerationContext:
    s = config.get_settings()
    with models.transaction() as conn:
        result = gate.admit_generation(
            conn,
            tenant_id=req.accountRef.tenantId,
            account_id=req.accountRef.accountId,
            free_tier_limit=s.free_tier_limit,
            prompt=prompt,
            device_key=req.rateLimitContext.deviceKey,
            client_ip_key=req.rateLimitContext.clientIpKey,
            rate_limit_device_max=s.rate_limit_device_max,
            rate_limit_ip_max=s.rate_limit_ip_max,
            rate_limit_window_seconds=s.rate_limit_window_seconds,
            lease_window_seconds=s.lease_window_seconds,
        )
        if result.reject_reason is not None:
            status, body = _REJECT_BODIES[result.reject_reason]
            raise Rejection(status, body)
        assert result.ctx is not None
        return result.ctx


@app.post("/v1/generate")
async def generate(
    req: GenerateRequest, _: None = Depends(require_internal_token)
) -> StreamingResponse:
    prompt = req.prompt.strip()
    if not prompt or len(prompt) > MAX_PROMPT_CHARS:
        raise Rejection(*_REJECT_BODIES["invalid_prompt"])

    ctx = _admit_request(req, prompt)

    async def sse() -> AsyncIterator[str]:
        async for payload in stream_generation(
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
            conversation_id=ctx.conversation_id,
            book_id=ctx.book_id,
            version_id=ctx.version_id,
            prompt=prompt,
        ):
            yield (
                f"event: {payload['event']}\n"
                f"data: {json.dumps(payload['data'], separators=(',', ':'))}\n\n"
            )

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
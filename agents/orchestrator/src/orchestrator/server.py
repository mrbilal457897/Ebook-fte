"""Orchestrator HTTP service (FastAPI/uvicorn on :8080 per quickstart).

Only the internal contract lives here (contracts/orchestrator-api.md): the
browser never reaches this service. The Next.js proxy authenticates the user
and presents a short-lived internal token; the Orchestrator derives business
context from the forwarded `accountRef`, never from model text (Article IV.5).

Admission + rejection order (contracts guarantee), grown through the tasks:

  T017 admission gate + JSON pre-stream rejections.
  T030 admit -> resolve model -> stream via ADK runner (this module).
  T031 BYOK resolution pre-stream (refund + terminal error on dead cred).
  T032 per-chunk persistence + terminal txn (hooks into stream_generation).
  T043 per-chunk lease renewal + release-on-terminal (same hooks).
"""

import json
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from orchestrator import byok, config, gate, models, persistence
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


def _record_rate_limit_blocked(req: GenerateRequest) -> None:
    """Persist the `rate_limit.blocked` audit row for an over-limit request
    (T016 / data-model.md): committed separately because the admission txn
    that detected the over-limit state rolls back entirely. PII stays out —
    only the prompt snippet + kind, never raw device/IP identifiers."""
    with models.transaction() as conn:
        models.record_audit(
            conn,
            tenant_id=req.accountRef.tenantId,
            account_id=req.accountRef.accountId,
            agent="orchestrator",
            action="rate_limit.blocked",
            inputs={"prompt": req.prompt[:200]},
            output={"error": "rate_limited"},
            status="blocked",
        )


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
            # Admission tx rolls back on reject (nothing stored there); the
            # over-limit case must still be auditable (T016: "only a
            # rate_limit.blocked audit row") in its own committed txn.
            if result.reject_reason == "rate_limited":
                _record_rate_limit_blocked(req)
            raise Rejection(status, body)
        assert result.ctx is not None
        return result.ctx


def _resolve_model_or_refund(
    req: GenerateRequest, ctx: gate.GenerationContext
) -> byok.ResolvedModel | None:
    """Resolve the model pre-stream. On an invalid/unwired BYOK credential:
    refund the consumed free credit, audit, release the lease, and return
    `None` so the endpoint can emit the terminal `error` event (FR-008,
    AC7/T027). Resolution happens in its own committed transaction."""
    try:
        with models.transaction() as conn:
            resolved = byok.resolve_generation_model(
                conn,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                credential_id=req.modelCredentialId,
            )
            if resolved is None:
                persistence.fail_generation(
                    conn,
                    tenant_id=ctx.tenant_id,
                    account_id=ctx.account_id,
                    lease_id=ctx.lease_id,
                    agent="orchestrator",
                    inputs={"prompt": req.prompt},
                    output={"error": "byok_invalid"},
                    refund=True,
                )
                return None
            # Live BYOK adapter check — invalid/unwired provider refunds too.
            byok.get_model_adapter(resolved)
            return resolved
    except NotImplementedError:
        with models.transaction() as conn:
            persistence.fail_generation(
                conn,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                lease_id=ctx.lease_id,
                agent="orchestrator",
                inputs={"prompt": req.prompt},
                output={"error": "byok_not_wired"},
                refund=True,
            )
        return None


@app.post("/v1/generate")
async def generate(
    req: GenerateRequest, _: None = Depends(require_internal_token)
) -> StreamingResponse:
    prompt = req.prompt.strip()
    if not prompt or len(prompt) > MAX_PROMPT_CHARS:
        raise Rejection(*_REJECT_BODIES["invalid_prompt"])

    s = config.get_settings()
    ctx = _admit_request(req, prompt)

    resolved = _resolve_model_or_refund(req, ctx)
    if resolved is None:
        async def err_only() -> AsyncIterator[str]:
            yield _sse("error", {"code": "byok_invalid", "message": "BYOK credential is invalid", "refunded": True})

        return StreamingResponse(err_only(), media_type="text/event-stream", headers=SSE_HEADERS)

    started = time.perf_counter()
    persisted_any = False

    def _persist_chunk(delta: str) -> None:
        nonlocal persisted_any
        with models.transaction() as conn:
            persistence.persist_chunk(
                conn,
                version_id=ctx.version_id,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                delta=delta,
                lease_id=ctx.lease_id,
                lease_window_seconds=s.lease_window_seconds,
            )
        persisted_any = True

    def _finalize(full: str) -> None:
        with models.transaction() as conn:
            persistence.finalize_generation(
                conn,
                version_id=ctx.version_id,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                lease_id=ctx.lease_id,
                agent="orchestrator",
                inputs={"prompt": req.prompt, "conversation_id": ctx.conversation_id},
                output={
                    "versionId": ctx.version_id,
                    "bookId": ctx.book_id,
                    "isPartial": False,
                    "fullText": full,
                },
                latency_ms=models.latency_ms(started),
                success=True,
            )

    def _fail(code: str) -> None:
        with models.transaction() as conn:
            persistence.fail_generation(
                conn,
                tenant_id=ctx.tenant_id,
                account_id=ctx.account_id,
                lease_id=ctx.lease_id,
                agent="orchestrator",
                inputs={"prompt": req.prompt},
                output={"error": code},
                refund=not persisted_any,
            )

    async def sse() -> AsyncIterator[str]:
        async for payload in stream_generation(
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
            conversation_id=ctx.conversation_id,
            book_id=ctx.book_id,
            version_id=ctx.version_id,
            prompt=prompt,
            model=None if resolved.provider == "platform" else resolved.model,
            on_token=_persist_chunk,
            on_terminal=_finalize,
            on_failure=_fail,
        ):
            yield _sse(payload["event"], payload["data"])

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


def _sse(event: str, data: dict[str, Any]) -> str:
    return (
        f"event: {event}\n"
        f"data: {json.dumps(data, separators=(',', ':'))}\n\n"
    )
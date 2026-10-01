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
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from google.adk.models.base_llm import BaseLlm
from pydantic import BaseModel, ConfigDict, Field

from orchestrator import byok, config, gate, models, persistence
from orchestrator.dbexec import run_blocking
from orchestrator.stream import stream_generation
from orchestrator.warmup import warm_adk, warmup_enabled

MAX_PROMPT_CHARS = 20_000


@asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Pay ADK's ~0.8 s cold-start cost at boot, not on a customer's first
    request (FR-004's 2 s budget). See warmup.py for the measurement."""
    if warmup_enabled():
        await warm_adk()
    yield


app = FastAPI(title="E-book FTE Orchestrator", version="0.1.0", lifespan=_lifespan)

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


async def _admit_request(
    req: GenerateRequest, prompt: str
) -> tuple[gate.GenerationContext, byok.ResolvedModel, BaseLlm | None] | None:
    """Admission + BYOK resolution in ONE transaction, on a worker thread.

    These used to be two sequential transactions. They are now one because
    both sit on the critical path to the first streamed token, and against a
    remote database one round trip costs 0.4-0.9 s (measured in T046) — so the
    second transaction was a full extra round trip of dead time before the
    customer saw a single word.

    Merging them is also strictly safer, not just faster: a dead BYOK
    credential is now detected in the same transaction that consumed the
    free-tier credit, so `fail_generation` refunds it in the same commit
    instead of a second one that could fail independently and leave the credit
    consumed (FR-008, AC7/T027).

    Returns `(ctx, resolved_model_spec, adk_model_object)`, or `None` when the
    credential was invalid or unwired — in which case the credit is already
    refunded, audited, and the lease released, so the endpoint only has to emit
    the terminal `error` event. The ADK model object is `None` on the platform
    path (ADK reads `GOOGLE_API_KEY` from the environment) and a real per-request
    model carrying the customer's key otherwise.
    """
    s = config.get_settings()

    def _admit_and_resolve() -> (
        tuple[gate.GenerationContext, byok.ResolvedModel, BaseLlm | None] | None
    ):
        try:
            # The `Rejection` is raised *inside* the transaction on purpose: a
            # rejected request must consume nothing, and `models.transaction()`
            # only rolls back on an exception. Deciding the rejection outside
            # the block would commit the free-tier increment from
            # `admit_generation`, which runs before the lease check.
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
                    raise Rejection(*_REJECT_BODIES[result.reject_reason])
                assert result.ctx is not None
                ctx = result.ctx

                def _fail(code: str) -> None:
                    persistence.fail_generation(
                        conn,
                        tenant_id=ctx.tenant_id,
                        account_id=ctx.account_id,
                        lease_id=ctx.lease_id,
                        agent="orchestrator",
                        inputs={"prompt": req.prompt},
                        output={"error": code},
                        refund=True,
                    )

                try:
                    resolved = byok.resolve_generation_model(
                        conn,
                        tenant_id=ctx.tenant_id,
                        account_id=ctx.account_id,
                        credential_id=req.modelCredentialId,
                    )
                except NotImplementedError:
                    _fail("byok_not_wired")
                    return None

                if resolved is None:
                    _fail("byok_invalid")
                    return None

                # Prove a BYOK provider is actually runnable *before* the credit
                # is committed and the stream opens. `build_model` raises only
                # for a provider with no adapter, so reaching here means a real
                # per-request model object exists and the customer's key travels
                # with it (FR-008, no platform-key fallback).
                try:
                    resolved_model = byok.build_model(resolved)
                except NotImplementedError:
                    _fail("byok_not_wired")
                    return None

                return (ctx, resolved, resolved_model)
        except Rejection as rejection:
            # The admission txn rolled back, so the over-limit case must still
            # be auditable (T016: "only a rate_limit.blocked audit row") in its
            # own committed txn.
            if rejection.body.get("code") == "rate_limited":
                _record_rate_limit_blocked(req)
            raise

    admitted = await run_blocking(_admit_and_resolve)
    return admitted


@app.post("/v1/generate")
async def generate(
    req: GenerateRequest, _: None = Depends(require_internal_token)
) -> StreamingResponse:
    prompt = req.prompt.strip()
    if not prompt or len(prompt) > MAX_PROMPT_CHARS:
        raise Rejection(*_REJECT_BODIES["invalid_prompt"])

    s = config.get_settings()
    admitted = await _admit_request(req, prompt)
    if admitted is None:
        async def err_only() -> AsyncIterator[str]:
            yield _sse("error", {"code": "byok_invalid", "message": "BYOK credential is invalid", "refunded": True})

        return StreamingResponse(err_only(), media_type="text/event-stream", headers=SSE_HEADERS)

    ctx, _resolved, resolved_model = admitted

    started = time.perf_counter()
    persisted_any = False

    async def _persist_chunk(delta: str) -> None:
        nonlocal persisted_any

        def _commit() -> None:
            # Pipelined (see models.pipelined_transaction): this runs once per
            # streamed chunk and must land before the token is emitted
            # (FR-005), so its round-trip cost is paid by the customer on every
            # single token. Two sequential statements at ~220 ms each is
            # ~440 ms of stall per chunk; one pipelined batch is ~220 ms.
            with models.pipelined_transaction() as conn:
                persistence.persist_chunk(
                    conn,
                    version_id=ctx.version_id,
                    tenant_id=ctx.tenant_id,
                    account_id=ctx.account_id,
                    delta=delta,
                    lease_id=ctx.lease_id,
                    lease_window_seconds=s.lease_window_seconds,
                )

        await run_blocking(_commit)
        persisted_any = True

    async def _finalize(full: str) -> None:
        def _commit() -> None:
            # Pipelined: five independent statements (finalize version, one
            # invocation, one audit row, release lease) that all take values
            # the caller already holds, so nothing here needs an earlier result.
            with models.pipelined_transaction() as conn:
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

        await run_blocking(_commit)

    async def _fail(code: str) -> None:
        def _commit() -> None:
            with models.pipelined_transaction() as conn:
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

        await run_blocking(_commit)

    async def sse() -> AsyncIterator[str]:
        async for payload in stream_generation(
            tenant_id=ctx.tenant_id,
            account_id=ctx.account_id,
            conversation_id=ctx.conversation_id,
            book_id=ctx.book_id,
            version_id=ctx.version_id,
            prompt=prompt,
            model=resolved_model,
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
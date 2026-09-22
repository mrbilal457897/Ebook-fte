import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getActiveByokCredential } from "@/lib/account-info"
import { getSession } from "@/lib/auth/session"
import { hashScopeKey } from "@/lib/rate-limit"
import { resolveTenancy } from "@/lib/tenancy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PROMPT_CHARS = 20_000

const SSE_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  Connection: "keep-alive",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
}

/**
 * T035 Next.js → Orchestrator proxy (internal contract, research.md §2).
 *
 * Auth + tenancy are resolved HERE from the session (never from the body);
 * the device/IP rate-limit keys are hashed here too (never raw). The
 * Orchestrator sees only: `accountRef {tenantId, accountId}`, an optional
 * BYOK `modelCredentialId`, a fresh `conversationId`, and the already-hashed
 * `rateLimitContext`. The upstream SSE stream is returned immediately with
 * SSE discipline headers, and pre-stream JSON rejections pass through
 * untouched (same status + body).
 *
 * Never middleware-only: the handler re-checks the session (CVE-2025-29927
 * class, research.md §1 security note).
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }

  let prompt: string
  try {
    const body = (await request.json()) as { prompt?: string }
    prompt = (body.prompt ?? "").trim()
  } catch {
    return NextResponse.json({ code: "invalid_prompt" }, { status: 400 })
  }
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ code: "invalid_prompt" }, { status: 400 })
  }

  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? ""
  const internalToken = process.env.INTERNAL_AUTH_TOKEN ?? ""
  if (!orchestratorUrl || !internalToken) {
    return NextResponse.json(
      { code: "internal", message: "ORCHESTRATOR_URL / INTERNAL_AUTH_TOKEN not configured" },
      { status: 500 },
    )
  }

  const tenancy = await resolveTenancy()
  const byok = await getActiveByokCredential()

  const deviceId = cookieValue(request.headers.get("cookie"), "fte_device_id") ?? session.user.id
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")

  const upstream = await fetch(`${orchestratorUrl}/v1/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": internalToken,
    },
    body: JSON.stringify({
      prompt,
      accountRef: { tenantId: tenancy.tenantId, accountId: tenancy.accountId },
      modelCredentialId: byok.credentialId,
      conversationId: randomUUID(),
      rateLimitContext: {
        deviceKey: hashScopeKey(`device:${deviceId}`),
        clientIpKey: clientIp ? hashScopeKey(`ip:${clientIp}`) : null,
      },
    }),
    cache: "no-store",
  })

  if (!upstream.ok) {
    const body = (await upstream.json().catch(() => ({ code: "upstream_error" }))) as Record<
      string,
      unknown
    >
    return NextResponse.json(body, { status: upstream.status })
  }

  return new Response(upstream.body, { headers: SSE_RESPONSE_HEADERS })
}

/** Minimal Cookie-header parsing (testable without `next/headers` cookies()). */
function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

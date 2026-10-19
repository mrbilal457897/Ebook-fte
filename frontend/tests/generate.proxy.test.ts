import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }))
vi.mock("@/lib/tenancy", () => ({
  resolveTenancy: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    accountId: "acct-1",
    freeTierCount: 1,
    freeTierLimit: 3,
  }),
}))
vi.mock("@/lib/account-info", () => ({
  getActiveByokCredential: vi.fn().mockResolvedValue({
    credentialId: null,
    provider: null,
  }),
}))

import { getSession } from "@/lib/auth/session"
import type { AuthSession } from "@/lib/auth/session"
import { getActiveByokCredential } from "@/lib/account-info"
import { resolveTenancy } from "@/lib/tenancy"
import { POST } from "@/app/api/generate/route"

const mockGetSession = vi.mocked(getSession)
const mockGetActiveByokCredential = vi.mocked(getActiveByokCredential)
const mockResolveTenancy = vi.mocked(resolveTenancy)
const mockFetch = vi.fn()

function sessionFor(userId: string, email = ""): AuthSession {
  return { user: { id: userId, email } } as AuthSession
}

function sseStream(...frames: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const f of frames) controller.enqueue(enc.encode(f))
      controller.close()
    },
  })
}

function request(prompt: string): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

describe("US2 proxy: /api/generate forwards to the Orchestrator (T035)", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockFetch.mockReset()
    // Both are `mockReset`ed *and* re-seeded: resetting alone would clear the
    // factory's default and leak one test's stub (an active BYOK credential)
    // into the next.
    mockResolveTenancy.mockReset()
    mockResolveTenancy.mockResolvedValue({
      tenantId: "tenant-1",
      accountId: "acct-1",
      freeTierCount: 1,
      freeTierLimit: 3,
    })
    mockGetActiveByokCredential.mockReset()
    mockGetActiveByokCredential.mockResolvedValue({ credentialId: null, provider: null })
    process.env.ORCHESTRATOR_URL = "http://localhost:8080"
    process.env.INTERNAL_AUTH_TOKEN = "test-secret"
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("returns 401 signed_out before any forward when not signed in", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: "signed_out" })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("forwards with accountRef derived from session, internal token, and hashed rate-limit keys", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockFetch.mockResolvedValue(
      new Response(sseStream('event: token\ndata: {"delta":"Ahoy"}\n\n'), {
        status: 200,
      }),
    )

    const res = await POST(request("a pirate memoir"))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:8080/v1/generate")
    expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe("test-secret")
    const body = JSON.parse(init.body as string) as {
      prompt: string
      accountRef: { tenantId: string; accountId: string }
      conversationId: string
      rateLimitContext: { deviceKey: string; clientIpKey: string | null }
    }
    expect(body.prompt).toBe("a pirate memoir")
    expect(body.accountRef).toEqual({ tenantId: "tenant-1", accountId: "acct-1" })
    expect(body.conversationId).toBeTruthy()
    expect(body.rateLimitContext.deviceKey).toMatch(/^[0-9a-f]{64}$/)
    expect(body.rateLimitContext.clientIpKey).toBeNull()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/event-stream")
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform")
    expect(res.headers.get("connection")).toBe("keep-alive")
  })

  it("includes the account's BYOK credential id when one is active", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockGetActiveByokCredential.mockResolvedValue({ credentialId: "cred-9", provider: "openai" })
    mockFetch.mockResolvedValue(new Response(sseStream(""), { status: 200 }))

    await POST(request("a tent"))

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      modelCredentialId: string | null
    }
    expect(body.modelCredentialId).toBe("cred-9")
  })

  it("invalid or missing prompt → 400 before any forward", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))

    const empty = await POST(request("   "))
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ code: "invalid_prompt" })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("passes pre-stream JSON rejections through untouched", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "free_tier_exhausted", upgrade: true }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ code: "free_tier_exhausted", upgrade: true })
  })
})

/**
 * Regression: an authenticated session with no `accounts` row used to escape
 * `resolveTenancy` uncaught, so the customer's very first generation returned
 * an opaque 500 with a stack trace instead of a code the UI could act on.
 */
describe("US2 proxy: tenancy and upstream faults are reported, not thrown (T035)", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockFetch.mockReset()
    mockResolveTenancy.mockReset()
    mockGetActiveByokCredential.mockReset()
    process.env.ORCHESTRATOR_URL = "http://localhost:8080"
    process.env.INTERNAL_AUTH_TOKEN = "test-secret"
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("returns 409 no_account when the session is not bound to a tenant", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockResolveTenancy.mockRejectedValue(new Error("no_account: session has no account row"))

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("no_account")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns 409 ambiguous_tenant rather than picking one tenant arbitrarily", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockResolveTenancy.mockRejectedValue(
      new Error("ambiguous_tenant: session resolves to 2 accounts"),
    )

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("ambiguous_tenant")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns 502 upstream_unavailable when the Orchestrator is unreachable", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockResolveTenancy.mockResolvedValue({
      tenantId: "tenant-1",
      accountId: "acct-1",
      freeTierCount: 1,
      freeTierLimit: 3,
    })
    mockGetActiveByokCredential.mockResolvedValue({ credentialId: null, provider: null })
    mockFetch.mockRejectedValue(new TypeError("fetch failed"))

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(502)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("upstream_unavailable")
  })

  it("does not leak an unrecognised internal error message to the client", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u-1"))
    mockResolveTenancy.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432"))

    const res = await POST(request("a pirate memoir"))

    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("internal")
    expect(JSON.stringify(body)).not.toContain("10.0.0.5")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ensureCurrentSessionLinked, linkCurrentSession } from "@/lib/auth/client-link"

const mockFetch = vi.fn()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("ensureCurrentSessionLinked", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("binds the session when no account row exists yet", async () => {
    // GET /api/account → 422 account_error (no accounts row), then the link.
    mockFetch
      .mockResolvedValueOnce(json({ code: "account_error" }, 422))
      .mockResolvedValueOnce(json({ tenantId: "tenant-1", accountId: "acct-1" }))

    await expect(ensureCurrentSessionLinked("example-press")).resolves.toBe(true)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [linkUrl, linkInit] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(linkUrl).toBe("/api/auth/tenant-link")
    expect(JSON.parse(linkInit.body as string)).toEqual({ tenantSlug: "example-press" })
  })

  it("is a no-op when the session is already bound", async () => {
    mockFetch.mockResolvedValueOnce(
      json({ freeTier: { used: 0, limit: 3, remaining: 3 }, inFlight: false }),
    )

    await expect(ensureCurrentSessionLinked("example-press")).resolves.toBe(true)

    // Critically no second call: linking an already-bound session against
    // another tenant's entry link is what produces `ambiguous_tenant`.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("does not attempt to link a signed-out visitor", async () => {
    mockFetch.mockResolvedValueOnce(json({ code: "signed_out" }, 401))

    await expect(ensureCurrentSessionLinked("example-press")).resolves.toBe(false)

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("reports failure when the link itself is refused", async () => {
    mockFetch
      .mockResolvedValueOnce(json({ code: "account_error" }, 422))
      .mockResolvedValueOnce(json({ code: "internal" }, 500))

    await expect(ensureCurrentSessionLinked("example-press")).resolves.toBe(false)
  })

  it("still attempts the link when the probe cannot be read at all", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(json({ tenantId: "tenant-1", accountId: "acct-1" }))

    await expect(ensureCurrentSessionLinked("example-press")).resolves.toBe(true)
  })
})

describe("linkCurrentSession", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the tenant and account on success", async () => {
    mockFetch.mockResolvedValueOnce(json({ tenantId: "tenant-9", accountId: "acct-9" }))

    await expect(linkCurrentSession("acme-books")).resolves.toEqual({
      ok: true,
      tenantId: "tenant-9",
      accountId: "acct-9",
    })
  })
})
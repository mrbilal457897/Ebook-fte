import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const poolQuery = vi.fn()

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: poolQuery }),
  requireDatabaseUrl: () => {},
}))

import { NextRequest } from "next/server"

import { getSession } from "@/lib/auth/session"
import { POST } from "@/app/api/generate/route"

const mockGetSession = vi.mocked(getSession)

describe("US1 gate: signed-out generation is rejected with nothing stored", () => {
  beforeEach(() => {
    poolQuery.mockClear()
    mockGetSession.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("returns 401 { code: 'signed_out' } with no session", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(requestWith("a pirate memoir"))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: "signed_out" })
  })

  it("never touches the database (zero rows created)", async () => {
    mockGetSession.mockResolvedValue(null)

    await POST(requestWith("a pirate memoir"))

    expect(poolQuery).not.toHaveBeenCalled()
  })
})

function requestWith(prompt: string): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  })
}

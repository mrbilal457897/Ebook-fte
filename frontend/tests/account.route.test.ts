import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: poolQuery }),
  requireDatabaseUrl: () => {},
}))

import { getSession } from "@/lib/auth/session"
import type { AuthSession } from "@/lib/auth/session"
import { GET } from "@/app/api/account/route"

const mockGetSession = vi.mocked(getSession)

const poolQuery = vi.fn()

function sessionFor(userId: string): AuthSession {
  return { user: { id: userId } } as AuthSession
}

function selectFor(sql: string, overrides: Partial<Record<"tenancy" | "lease" | "cred", boolean>>) {
  if (sql.includes("auth_subject")) {
    return {
      rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
      rowCount: 1,
    }
  }
  if (sql.includes("FROM run_states"))
    return overrides.lease ? { rows: [{}], rowCount: 1 } : { rows: [], rowCount: 0 }
  if (sql.includes("JOIN accounts a ON a.active_byok_credential_id")) {
    if (overrides.cred) return { rows: [{ provider: "gemini" }], rowCount: 1 }
    return { rows: [], rowCount: 0 }
  }
  return { rows: [], rowCount: 0 }
}

describe("T033 GET /api/account: allowance + in-flight + BYOK state", () => {
  beforeEach(() => {
    poolQuery.mockReset()
    poolQuery.mockImplementation((sql: string) => selectFor(sql, {}))
    mockGetSession.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("returns 401 signed_out without a session", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: "signed_out" })
  })

  it("returns allowance/lease/BYOK derived from the session account", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u1"))
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM run_states")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      freeTier: { used: 1, limit: 3, remaining: 2 },
      inFlight: false,
      activeByokProvider: null,
    })
  })

  it("reflects a live cross-device lease and an active BYOK provider", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u1"))
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 3, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM run_states")) return { rows: [{}], rowCount: 1 }
      if (sql.includes("JOIN accounts a ON a.active_byok_credential_id")) {
        return { rows: [{ provider: "gemini" }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      freeTier: { used: 3, limit: 3, remaining: 0 },
      inFlight: true,
      activeByokProvider: "gemini",
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: poolQuery }),
  requireDatabaseUrl: () => {},
}))

import { GET } from "@/app/api/generation/[id]/route"
import type { AuthSession } from "@/lib/auth/session"
import { getSession } from "@/lib/auth/session"

const mockGetSession = vi.mocked(getSession)
const poolQuery = vi.fn()

function sessionFor(userId: string): AuthSession {
  return { user: { id: userId } } as AuthSession
}

function savedRowFor(overrides: Partial<Record<"content" | "partial" | "gone", boolean>> = {}) {
  if (overrides.gone) return { rows: [], rowCount: 0 }
  return {
    rows: [
      {
        version_id: "v-1",
        book_id: "b-1",
        conversation_id: "c-1",
        content: overrides.content ? "The fog lifted." : "The fog ",
        is_partial: overrides.partial ?? true,
        updated_at: "2026-09-22T10:00:00Z",
      },
    ],
    rowCount: 1,
  }
}

describe("T041/T044 GET /api/generation/[id]: interruption-salvage refetch", () => {
  beforeEach(() => {
    poolQuery.mockReset()
    mockGetSession.mockReset()
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM content_versions cv")) return savedRowFor()
      return { rows: [], rowCount: 0 }
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("returns 401 signed_out without a session", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(new Request("http://x/api/generation/v-1"), {
      params: Promise.resolve({ id: "v-1" }),
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: "signed_out" })
  })

  it("returns 200 with exactly what the UI rendered before the interruption", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u1"))
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM content_versions cv"))
        return savedRowFor({ content: true, partial: true })
      return { rows: [], rowCount: 0 }
    })

    const res = await GET(new Request("http://x/api/generation/v-1"), {
      params: Promise.resolve({ id: "v-1" }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      versionId: "v-1",
      bookId: "b-1",
      conversationId: "c-1",
      content: "The fog lifted.",
      isPartial: true,
      updatedAt: "2026-09-22T10:00:00Z",
    })
  })

  it("returns 404 when the version is not in the caller's tenant", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u1"))
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM content_versions cv")) return savedRowFor({ gone: true })
      return { rows: [], rowCount: 0 }
    })

    const res = await GET(new Request("http://x/api/generation/v-9"), {
      params: Promise.resolve({ id: "v-9" }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: "not_found" })
  })

  it("flags a completed generation as isPartial false", async () => {
    mockGetSession.mockResolvedValue(sessionFor("u1"))
    poolQuery.mockImplementation((sql: string) => {
      if (sql.includes("auth_subject")) {
        return {
          rows: [{ tenant_id: "t1", id: "a1", free_tier_count: 1, free_tier_limit: 3 }],
          rowCount: 1,
        }
      }
      if (sql.includes("FROM content_versions cv"))
        return savedRowFor({ content: true, partial: false })
      return { rows: [], rowCount: 0 }
    })

    const res = await GET(new Request("http://x/api/generation/v-1"), {
      params: Promise.resolve({ id: "v-1" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).isPartial).toBe(false)
  })
})

import { describe, expect, it, vi } from "vitest"

const poolQuery = vi.fn()

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: poolQuery }),
  requireDatabaseUrl: () => {},
}))

import { onFirstSignIn } from "@/lib/auth/tenant-link"

/*
 * Fires the same first-sign-in linkage for email/password and OAuth arrivals:
 * the tenant slug the visitor arrived through resolves to a tenant_id, and a
 * single accounts row is bound to it with free_tier_count = 0 and
 * free_tier_limit = 3 (FR-010, spec scenario 1; data-model.md).
 */
describe("US1: sign-up binds the account to the arriving tenant", () => {
  const T = (email: string) =>
    onFirstSignIn({
      tenantSlug: "example-press",
      authSubject: `auth-${email}`,
      email,
    })

  it("binds an email/password sign-up to the tenant with 3 free generations", async () => {
    poolQuery.mockReset()
    poolQuery.mockImplementation((sql: string) => {
      if (/FROM tenants\b/.test(sql)) {
        return { rows: [{ id: "tenant-1", name: "Example Press" }], rowCount: 1 }
      }
      if (/INSERT INTO accounts/.test(sql)) {
        return { rows: [{ id: "account-1" }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await T("Author@Example.com")
    expect(result.tenantId).toBe("tenant-1")
    expect(result.accountId).toBe("account-1")

    const calls = poolQuery.mock.calls.map((c) => c[0] as string)
    const insert = calls.find((sql) => sql.includes("INSERT INTO accounts"))
    expect(insert).toBeDefined()
    expect(insert).toContain("free_tier_count")
    expect(insert).toContain("free_tier_limit")
    expect(insert).toMatch(/ON CONFLICT/)

    const insertParams = poolQuery.mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO accounts"),
    )![1] as unknown[]
    expect(insertParams).toContain("tenant-1")
    expect(insertParams).toContain("author@example.com")
    expect(insertParams).toContain(3)
  })

  it("binds an OAuth sign-up to the tenant the same way", async () => {
    poolQuery.mockReset()
    poolQuery.mockImplementation((sql: string) => {
      if (/FROM tenants\b/.test(sql)) {
        return { rows: [{ id: "tenant-1", name: "Example Press" }], rowCount: 1 }
      }
      if (/INSERT INTO accounts/.test(sql)) {
        return { rows: [{ id: "account-2" }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const result = await T("oauth.user@gmail.com")
    expect(result.tenantId).toBe("tenant-1")
    expect(result.accountId).toBe("account-2")

    const insertParams = poolQuery.mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO accounts"),
    )![1] as unknown[]
    expect(insertParams).toContain("tenant-1")
    expect(insertParams).toContain("oauth.user@gmail.com")
  })

  it("fails loudly when the arriving tenant slug is unknown", async () => {
    poolQuery.mockReset()
    poolQuery.mockImplementation(() => ({ rows: [], rowCount: 0 }))

    await expect(
      onFirstSignIn({
        tenantSlug: "does-not-exist",
        authSubject: "auth-x",
        email: "x@example.com",
      }),
    ).rejects.toThrow()
  })
})

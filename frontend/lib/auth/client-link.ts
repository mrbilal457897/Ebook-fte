"use client"

/**
 * Client-side call to the server-only tenant-link route (T022 seam).
 * Keeps `pg`/DAL code off the browser bundle — this module only fetches.
 */

export async function linkCurrentSession(tenantSlug: string): Promise<{
  ok: boolean
  tenantId?: string
  accountId?: string
}> {
  const res = await fetch("/api/auth/tenant-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantSlug }),
  })
  if (!res.ok) return { ok: false }
  const json = (await res.json()) as {
    tenantId?: string
    accountId?: string
  }
  return { ok: true, ...json }
}

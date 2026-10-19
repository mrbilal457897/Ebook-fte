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

/**
 * Bind the current session to the entry tenant, but only if it is not already
 * bound — `linkCurrentSession` is the first-sign-in seam and calling it
 * unconditionally on every page would let a signed-in user who follows another
 * tenant's entry link (`?tenant=…`) acquire a second account, which
 * `resolveTenancy` then rejects as `ambiguous_tenant`.
 *
 * `GET /api/account` is the authority on whether a binding exists: it resolves
 * tenancy from the session, so 200 means bound, 401 means signed out, and
 * anything else means the `accounts` row is missing and needs creating.
 */
export async function ensureCurrentSessionLinked(tenantSlug: string): Promise<boolean> {
  let bound = false
  try {
    const probe = await fetch("/api/account", { cache: "no-store" })
    if (probe.status === 401) return false
    bound = probe.ok
  } catch {
    /* fall through and attempt the link */
  }
  if (bound) return true
  const link = await linkCurrentSession(tenantSlug)
  return link.ok
}

import { randomUUID } from "crypto"

import { getPool, requireDatabaseUrl } from "@/lib/db"

type Tenant = { id: string; name: string }

export async function resolveTenantBySlug(slug: string): Promise<Tenant> {
  requireDatabaseUrl()
  const res = await getPool().query<Tenant>(`SELECT id, name FROM tenants WHERE slug = $1`, [slug])
  if (res.rowCount === 0) throw new Error(`tenant_not_found: no tenant for slug "${slug}"`)
  return res.rows[0]
}

export type LinkedAccount = {
  tenantId: string
  accountId: string
  created: boolean
}

/**
 * Create the `accounts` row for a first sign-in (T022), tenant-scoped.
 *
 * `email` is normalized (trimmed, case-folded) before insert so the
 * `(tenant_id, email)` unique constraint is deterministic; `auth_subject`
 * carries the authenticated session's user id so resolveTenancy can bind
 * future requests to this account (data-model.md). Free-tier allowance is
 * seeded 0 used / 3 limit (FR-010).
 */
export async function ensureAccount(input: {
  tenantId: string
  authSubject: string
  email: string
  freeTierLimit?: number
}): Promise<LinkedAccount> {
  requireDatabaseUrl()
  const email = input.email.trim().toLowerCase()
  const limit = input.freeTierLimit ?? 3
  const pool = getPool()

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO accounts
        (id, tenant_id, email, auth_subject, free_tier_count,
         free_tier_limit, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, $5, now(), now())
     ON CONFLICT (tenant_id, email) DO NOTHING
     RETURNING id`,
    [randomUUID(), input.tenantId, email, input.authSubject, limit],
  )
  if (inserted.rowCount === 1)
    return {
      tenantId: input.tenantId,
      accountId: inserted.rows[0].id,
      created: true,
    }

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM accounts WHERE tenant_id = $1 AND auth_subject = $2`,
    [input.tenantId, input.authSubject],
  )
  if (existing.rowCount === 0)
    throw new Error(
      "account_conflict: email already belongs to this tenant but is bound to another session",
    )
  return {
    tenantId: input.tenantId,
    accountId: existing.rows[0].id,
    created: false,
  }
}

import { getSession } from "@/lib/auth/session"
import { getPool } from "@/lib/db"

export type Tenancy = {
  tenantId: string
  accountId: string
  freeTierCount: number
  freeTierLimit: number
}

/**
 * Derive the caller's business tenancy from the authenticated session.
 *
 * `tenant_id`/`account_id` come ONLY from the session → the `accounts`
 * row bound via `auth_subject` (Article IV.5). Client-supplied text is
 * never consulted. Throws when no session, no matching account, or a
 * session maps to more than one account in a tenant (Q3: one account per
 * tenant — an ambiguous session must fail loudly, never guess).
 */
export async function resolveTenancy(): Promise<Tenancy> {
  const session = await getSession()
  const authSubject = session?.user?.id
  if (!authSubject) throw new Error("signed_out: no authenticated session")

  const result = await getPool().query<{
    tenant_id: string
    id: string
    free_tier_count: number
    free_tier_limit: number
  }>(
    `SELECT tenant_id, id, free_tier_count, free_tier_limit
     FROM accounts
     WHERE auth_subject = $1`,
    [authSubject],
  )

  if (result.rowCount === 0) throw new Error("no_account: session has no account row")

  const scope = new Set(result.rows.map((r) => r.tenant_id))
  if (scope.size > 1)
    throw new Error(
      "ambiguous_tenant: session is bound to more than one tenant account; resolve before proceeding",
    )

  const row = result.rows[0]
  return {
    tenantId: row.tenant_id,
    accountId: row.id,
    freeTierCount: row.free_tier_count,
    freeTierLimit: row.free_tier_limit,
  }
}

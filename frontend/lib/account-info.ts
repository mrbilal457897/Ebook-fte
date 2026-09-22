import { getPool, requireDatabaseUrl } from "@/lib/db"
import { resolveTenancy } from "@/lib/tenancy"

export type ModelProvider = "gemini" | "openai" | "anthropic"

export type AccountInfo = {
  freeTier: { used: number; limit: number; remaining: number }
  inFlight: boolean
  activeByokProvider: ModelProvider | null
}

export type ByokInfo = {
  credentialId: string | null
  provider: ModelProvider | null
}

function toModelProvider(raw: string | undefined | null): ModelProvider | null {
  if (raw === "gemini" || raw === "openai" || raw === "anthropic") return raw
  return null
}

/**
 * The account's active BYOK credential (T031 seam, read-side). Derives the
 * `modelCredentialId` the proxy forwards to the Orchestrator so the model
 * call is billed to the customer's own key — the proxy never sees the key
 * itself, only the encrypted-row id (data-model.md, Article VII.2).
 */
export async function getActiveByokCredential(): Promise<ByokInfo> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const res = await getPool().query<{ id: string; provider: string }>(
    `SELECT mc.id, mc.provider
     FROM model_credentials mc
     JOIN accounts a ON a.active_byok_credential_id = mc.id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [tenancy.accountId, tenancy.tenantId],
  )
  const row = res.rows[0]
  if (!row) return { credentialId: null, provider: null }
  return { credentialId: row.id, provider: toModelProvider(row.provider) }
}

/**
 * T033 payload for `GET /api/account`: allowance read, cross-device in-flight
 * state (live `run_states` lease), and active BYOK provider. All values are
 * derived from the authenticated session (lib/tenancy) — nothing from the
 * request body.
 */
export async function getAccountInfo(): Promise<AccountInfo> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const pool = getPool()

  const [lease, cred] = await Promise.all([
    pool.query<{ one: number }>(
      `SELECT 1 AS one
       FROM run_states
       WHERE tenant_id = $1 AND account_id = $2 AND kind = 'generation'
         AND lock_expires_at > now()
       LIMIT 1`,
      [tenancy.tenantId, tenancy.accountId],
    ),
    pool.query<{ provider: string }>(
      `SELECT mc.provider
       FROM model_credentials mc
       JOIN accounts a ON a.active_byok_credential_id = mc.id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [tenancy.accountId, tenancy.tenantId],
    ),
  ])

  const used = tenancy.freeTierCount
  const limit = tenancy.freeTierLimit
  return {
    freeTier: { used, limit, remaining: Math.max(0, limit - used) },
    inFlight: (lease.rowCount ?? 0) > 0,
    activeByokProvider: toModelProvider(cred.rows[0]?.provider),
  }
}

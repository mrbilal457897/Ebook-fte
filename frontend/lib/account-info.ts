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

export type SavedContent = {
  versionId: string
  bookId: string
  conversationId: string | null
  content: string
  isPartial: boolean
  updatedAt: string
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

/**
 * T044 interruption-salvage read for `GET /api/generation/[id]` (AC4). Only
 * returns a version the caller's tenant+account owns (never a cross-tenant
 * read — Article IV.5). The `conversationId` is the account's most recent
 * conversation (the one created when the version was admitted); the schema
 * has no direct version→conversation link, so null when none exists yet.
 */
export async function getSavedContent(versionId: string): Promise<SavedContent | null> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const res = await getPool().query<{
    version_id: string
    book_id: string
    conversation_id: string | null
    content: string
    is_partial: boolean
    updated_at: string
  }>(
    `SELECT cv.id                             AS version_id,
            cv.book_id                         AS book_id,
            cv.content                         AS content,
            cv.is_partial                      AS is_partial,
            cv.updated_at                      AS updated_at,
            (SELECT c.id
             FROM conversations c
             WHERE c.tenant_id = cv.tenant_id AND c.account_id = cv.account_id
             ORDER BY c.created_at DESC
             LIMIT 1)                          AS conversation_id
     FROM content_versions cv
     WHERE cv.id = $3 AND cv.tenant_id = $1 AND cv.account_id = $2`,
    [tenancy.tenantId, tenancy.accountId, versionId],
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    versionId: row.version_id,
    bookId: row.book_id,
    conversationId: row.conversation_id,
    content: row.content,
    isPartial: row.is_partial,
    updatedAt: row.updated_at,
  }
}

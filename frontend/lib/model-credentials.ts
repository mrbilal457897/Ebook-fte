import { createCipheriv, randomBytes } from "node:crypto"

import { type ModelProvider } from "@/lib/account-info"
import { recordAudit } from "@/lib/audit"
import { getPool, requireDatabaseUrl } from "@/lib/db"
import { resolveTenancy } from "@/lib/tenancy"

/**
 * BYOK credential storage (Principle 3: BYOK first-class, encrypted at rest).
 *
 * A customer's provider key is sealed here with AES-256-GCM before it ever
 * reaches Postgres, and is never returned over the wire again — only the row id
 * and provider come back. The Orchestrator opens it in-memory for the duration
 * of one request (`agents/orchestrator/src/orchestrator/byok.py`).
 *
 * The sealed blob is `nonce || ciphertext || tag`, prefixed `gcm:` so the reader
 * can tell a real seal from a dev seed. GCM is authenticated, so a tampered
 * row raises in the reader rather than decrypting to garbage.
 */

const PREFIX = "gcm:"
const NONCE_BYTES = 12

export type StoredCredential = {
  credentialId: string
  provider: ModelProvider
  createdAt: string
  isActive: boolean
}

export class ByokEncryptionUnavailable extends Error {}

/**
 * Read the 32-byte AES key from the environment.
 *
 * `BYOK_ENCRYPTION_KEY` is base64. This throws rather than falling back to an
 * unencrypted write: silently storing a provider key in the clear because a
 * secret was missing is precisely the failure the `bytea` column exists to
 * prevent (AGENTS.md §5 Secrets).
 */
function encryptionKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new ByokEncryptionUnavailable(
      "BYOK_ENCRYPTION_KEY is not configured, so a provider key cannot be stored " +
        "encrypted. Generate one with: openssl rand -base64 32",
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new ByokEncryptionUnavailable(
      `BYOK_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, got ${key.length}`,
    )
  }
  return key
}

export function sealApiKey(plaintext: string): Buffer {
  const nonce = randomBytes(NONCE_BYTES)
  const sealed = createCipheriv("aes-256-gcm", encryptionKey(), nonce)
  const ciphertext = Buffer.concat([sealed.update(plaintext, "utf8"), sealed.final()])
  return Buffer.concat([Buffer.from(PREFIX, "utf8"), nonce, ciphertext, sealed.getAuthTag()])
}

/**
 * Keys arrive from a password-style input, so obvious rubbish is rejected at
 * the boundary rather than being sealed and then failing at the provider.
 * Length bounds only — never inspect or log the value itself.
 */
export function assertLooksLikeApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed.length < 16) {
    throw new Error("That key looks too short to be a provider API key.")
  }
  if (trimmed.length > 512) {
    throw new Error("That key is implausibly long — check for a paste accident.")
  }
  if (/[\s]/.test(trimmed)) {
    throw new Error("That key contains whitespace — copy it without spaces.")
  }
}

export function isModelProvider(raw: unknown): raw is ModelProvider {
  return raw === "gemini" || raw === "openai" || raw === "anthropic"
}

/**
 * Store a customer's provider key and make it the account's active credential,
 * in one transaction (Article V: the action and its audit row share a commit).
 *
 * `tenant_id` and `account_id` come from the authenticated session, never from
 * the request body (Article IV.5). Previous credentials for the same provider
 * are kept, not deleted, so switching back is possible and so an audit trail of
 * what was connected exists.
 */
export async function saveCredential(params: {
  provider: ModelProvider
  apiKey: string
  label?: string
}): Promise<StoredCredential> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  assertLooksLikeApiKey(params.apiKey)

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const inserted = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO model_credentials
         (id, tenant_id, account_id, provider, encrypted_key, last_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'valid', now(), now())
       RETURNING id, created_at`,
      [tenancy.tenantId, tenancy.accountId, params.provider, sealApiKey(params.apiKey.trim())],
    )
    const row = inserted.rows[0]
    if (!row) throw new Error("credential insert returned no row")

    await client.query(
      `UPDATE accounts
       SET active_byok_credential_id = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [tenancy.accountId, tenancy.tenantId, row.id],
    )

    // The key itself is never an audit input — only the fact that a credential
    // was connected, for which provider, and the row id.
    await recordAudit(client, {
      tenantId: tenancy.tenantId,
      accountId: tenancy.accountId,
      agent: "frontend-byok",
      action: "model_credential.saved",
      inputs: { credentialId: row.id, provider: params.provider, label: params.label ?? null },
      status: "success",
    })

    await client.query("COMMIT")
    return {
      credentialId: row.id,
      provider: params.provider,
      createdAt: row.created_at.toISOString(),
      isActive: true,
    }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/**
 * List the account's credentials for the settings UI. Returns no key material —
 * there is no column to return it from, which is the point.
 */
export async function listCredentials(): Promise<StoredCredential[]> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const res = await getPool().query<{
    id: string
    provider: string
    created_at: Date
    is_active: boolean
  }>(
    `SELECT mc.id, mc.provider, mc.created_at,
            (a.active_byok_credential_id = mc.id) AS is_active
       FROM model_credentials mc
       JOIN accounts a ON a.id = $1 AND a.tenant_id = $2
      WHERE mc.tenant_id = $2 AND mc.account_id = $1
      ORDER BY mc.created_at DESC`,
    [tenancy.accountId, tenancy.tenantId],
  )
  return res.rows.map((row) => ({
    credentialId: row.id,
    provider: isModelProvider(row.provider) ? row.provider : "gemini",
    createdAt: row.created_at.toISOString(),
    isActive: row.is_active,
  }))
}

/** Point the account at an existing credential (or at none, to fall back to
 *  the platform key). Tenant- and account-scoped: another account's id is a
 *  no-op that reports nothing was changed. */
export async function setActiveCredential(credentialId: string | null): Promise<boolean> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const pool = getPool()

  if (credentialId === null) {
    await pool.query(
      `UPDATE accounts SET active_byok_credential_id = NULL, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [tenancy.accountId, tenancy.tenantId],
    )
    await recordAudit(null, {
      tenantId: tenancy.tenantId,
      accountId: tenancy.accountId,
      agent: "frontend-byok",
      action: "model_credential.deactivated",
      inputs: {},
      status: "success",
    })
    return true
  }

  const updated = await pool.query(
    `UPDATE accounts a
        SET active_byok_credential_id = mc.id, a.updated_at = now()
       FROM model_credentials mc
      WHERE a.id = $1 AND a.tenant_id = $2
        AND mc.id = $3 AND mc.tenant_id = a.tenant_id AND mc.account_id = a.id`,
    [tenancy.accountId, tenancy.tenantId, credentialId],
  )
  if ((updated.rowCount ?? 0) === 0) return false

  await recordAudit(null, {
    tenantId: tenancy.tenantId,
    accountId: tenancy.accountId,
    agent: "frontend-byok",
    action: "model_credential.activated",
    inputs: { credentialId },
    status: "success",
  })
  return true
}

/** Remove one credential. Only ever deletes a row the caller's own
 *  tenant+account owns, and clears `active_byok_credential_id` when it pointed
 *  at that row so no account is left dangling at a deleted credential. */
export async function deleteCredential(credentialId: string): Promise<boolean> {
  requireDatabaseUrl()
  const tenancy = await resolveTenancy()
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const removed = await client.query(
      `DELETE FROM model_credentials
        WHERE id = $3 AND tenant_id = $1 AND account_id = $2`,
      [tenancy.tenantId, tenancy.accountId, credentialId],
    )
    if ((removed.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK")
      return false
    }
    await client.query(
      `UPDATE accounts
          SET active_byok_credential_id = NULL, updated_at = now()
        WHERE id = $1 AND tenant_id = $2 AND active_byok_credential_id = $3`,
      [tenancy.accountId, tenancy.tenantId, credentialId],
    )
    await recordAudit(client, {
      tenantId: tenancy.tenantId,
      accountId: tenancy.accountId,
      agent: "frontend-byok",
      action: "model_credential.deleted",
      inputs: { credentialId },
      status: "success",
    })
    await client.query("COMMIT")
    return true
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}


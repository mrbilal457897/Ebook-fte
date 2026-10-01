import type { PoolClient, QueryResult, QueryResultRow } from "pg"

/**
 * One place to write an `audit_log` row (Principle 5: every action is
 * auditable, in the same transaction as the action itself).
 *
 * `client` is the transaction handle the action is running in, so the audit row
 * commits or rolls back with it — a rolled-back action leaves no audit row, and
 * a committed action cannot be missing one. Passing `null` uses the pool
 * directly, which is only correct for events that are *not* part of a business
 * transaction (e.g. a rate-limit block, whose admission transaction rolled back
 * by design).
 *
 * Callers must never pass secret material in `inputs`. This module cannot detect
 * that, so it is a documented obligation, not an enforced one.
 */
export type AuditInput = {
  tenantId: string
  accountId: string | null
  agent: string
  action: string
  inputs?: Record<string, unknown>
  output?: Record<string, unknown>
  status?: string
}

const INSERT = `INSERT INTO audit_log (tenant_id, account_id, agent, action, inputs, output, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`

export async function recordAudit(
  client: PoolClient | null,
  row: AuditInput,
): Promise<QueryResult<QueryResultRow>> {
  const params = [
    row.tenantId,
    row.accountId,
    row.agent,
    row.action,
    JSON.stringify(row.inputs ?? {}),
    row.output ? JSON.stringify(row.output) : null,
    row.status ?? "success",
  ]
  if (client) return client.query(INSERT, params)
  const { getPool } = await import("@/lib/db")
  return getPool().query(INSERT, params)
}
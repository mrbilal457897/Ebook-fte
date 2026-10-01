import type { PoolClient } from "pg"

import { recordAudit } from "@/lib/audit"
import { getPool } from "@/lib/db"
import {
  mapInvoiceStatus,
  mapSubscriptionStatus,
  type LagoInvoicePayload,
  type LagoSubscriptionPayload,
} from "@/lib/lago"

/**
 * Persistence for Lago billing state (Principle 4: the system of record).
 *
 * Everything here runs in one transaction with its audit row, per AGENTS.md §5.
 * `lib/lago.ts` holds the pure protocol/signature code so it can be tested
 * without a database; this module owns the SQL.
 */

export interface LocalAccount {
  accountId: string
  tenantId: string
  email: string
}

/** Which Lago tier a subscription status earns, and the mirror row's status. */
function tierForPlan(planCode: string): "free" | "pro" | "enterprise" {
  if (planCode === "enterprise") return "enterprise"
  if (planCode === "pro") return "pro"
  return "free"
}

/**
 * Has this Lago delivery already been applied?
 *
 * This is the replay defence. Lago's HMAC signature covers the raw body with no
 * timestamp, so a body captured in transit can be re-sent at any time and will
 * verify forever. The `X-Lago-Unique-Key` header is Lago's guarantee that a
 * given delivery is meant to be processed once; the unique index on the
 * receipts table is what enforces it.
 *
 * Returns true if seen. The caller must still INSERT the key inside the same
 * transaction as the effect — checking here is only a fast path, and the
 * unique index is the actual guarantee against two concurrent deliveries.
 */
export async function webhookReceiptSeen(uniqueKey: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 FROM billing_webhook_receipts WHERE unique_key = $1",
    [uniqueKey],
  )
  return rows.length > 0
}

/**
 * Record (or re-point) a subscription and keep accounts.subscription_tier in
 * step, atomically with the audit row.
 *
 * The account is located by the Lago customer external id, which is our
 * accounts.id — never by an id from the webhook body. A webhook naming an
 * external_customer_id we do not know updates nothing and reports it, rather
 * than creating a subscription row for a customer that does not exist here.
 */
export async function applySubscription(
  client: PoolClient,
  payload: LagoSubscriptionPayload,
): Promise<{ applied: boolean; reason?: string }> {
  const { rows: accountRows } = await client.query<{ id: string; tenant_id: string }>(
    "SELECT id, tenant_id FROM accounts WHERE id = $1",
    [payload.external_customer_id],
  )
  const account = accountRows[0]
  if (!account) {
    return { applied: false, reason: `no local account for Lago customer ${payload.external_customer_id}` }
  }

  const status = mapSubscriptionStatus(payload.status)
  const tier = status === "active" ? tierForPlan(payload.plan_code) : "free"

  await client.query(
    `INSERT INTO subscriptions
       (tenant_id, account_id, lago_external_id, lago_customer_id, plan_code,
        external_id, status, started_at, ending_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (lago_external_id) DO UPDATE
       SET status = EXCLUDED.status,
           plan_code = EXCLUDED.plan_code,
           started_at = EXCLUDED.started_at,
           ending_at = EXCLUDED.ending_at,
           updated_at = now()`,
    [
      account.tenant_id,
      account.id,
      payload.lago_id,
      payload.external_customer_id,
      payload.plan_code,
      payload.external_id,
      status,
      payload.started_at,
      payload.ending_at,
    ],
  )

  // Only an *active* Lago subscription grants a paid tier. A suspended or
  // terminated subscription drops the account back to free rather than leaving
  // a lapsed customer on Pro forever.
  await client.query("UPDATE accounts SET subscription_tier = $2, updated_at = now() WHERE id = $1", [
    account.id,
    tier,
  ])

  await recordAudit(client, {
    tenantId: account.tenant_id,
    accountId: account.id,
    agent: "lago-webhook",
    action: `subscription.${status}`,
    inputs: {
      lago_id: payload.lago_id,
      plan_code: payload.plan_code,
      // The provider status is kept because it is how an unexpected value that
      // mapSubscriptionStatus() flattened to `pending` becomes visible.
      provider_status: payload.status,
    },
  })

  return { applied: true }
}

/** Mirror a Lago invoice, and mark it paid if it is now paid. */
export async function applyInvoice(
  client: PoolClient,
  payload: LagoInvoicePayload,
): Promise<{ applied: boolean; reason?: string }> {
  const externalCustomerId = payload.customer?.external_id
  if (!externalCustomerId) {
    return { applied: false, reason: "invoice payload has no customer.external_id" }
  }

  const { rows: accountRows } = await client.query<{ id: string; tenant_id: string }>(
    "SELECT id, tenant_id FROM accounts WHERE id = $1",
    [externalCustomerId],
  )
  const account = accountRows[0]
  if (!account) {
    return { applied: false, reason: `no local account for Lago customer ${externalCustomerId}` }
  }

  const status = mapInvoiceStatus(payload.status)
  const { rows: subRows } = await client.query<{ id: string }>(
    "SELECT id FROM subscriptions WHERE lago_external_id = $1",
    [payload.subscriptions?.[0]?.lago_id ?? ""],
  )

  await client.query(
    `INSERT INTO invoices
       (tenant_id, account_id, subscription_id, lago_external_id, number, status,
        amount_cents, currency, issued_at, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (lago_external_id) DO UPDATE
       SET status = EXCLUDED.status,
           paid_at = EXCLUDED.paid_at,
           updated_at = now()`,
    [
      account.tenant_id,
      account.id,
      subRows[0]?.id ?? null,
      payload.lago_id,
      payload.number,
      status,
      payload.amount_cents,
      payload.amount_currency,
      payload.issuing_date,
      payload.paid_at,
    ],
  )

  await recordAudit(client, {
    tenantId: account.tenant_id,
    accountId: account.id,
    agent: "lago-webhook",
    action: `invoice.${status}`,
    inputs: { lago_id: payload.lago_id, number: payload.number },
  })

  return { applied: true }
}

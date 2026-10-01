import { NextResponse } from "next/server"

import { recordAudit } from "@/lib/audit"
import { getSession } from "@/lib/auth/session"
import { getPool, requireDatabaseUrl } from "@/lib/db"
import { ensureLagoCustomer, getCheckoutUrl, isLagoConfigured } from "@/lib/lago"
import { resolveTenancy } from "@/lib/tenancy"

export const dynamic = "force-dynamic"

/**
 * T040 upgrade trigger (US3, FR-011): called by the exhaustion prompt when the
 * customer hits "Upgrade". Auth required.
 *
 * This used to be a stub that recorded intent and handed back a static
 * LAGO_CHECKOUT_URL, deferring "checkout is a separate slice". A static URL
 * cannot be per-customer, so it was never going to link a payment to an
 * account — the worst outcome for a billing path, because it looks complete.
 *
 * What it does now, in Lago's actual order of operations:
 *
 *   1. ensure the Lago customer exists for this account (idempotent on
 *      external_id, which is our accounts.id)
 *   2. ask Lago for the gateway-hosted checkout URL where the customer stores a
 *      payment method
 *   3. hand that URL back
 *
 * The subscription itself is NOT created here. On the gateway, step 2 is a
 * pre-authorisation, and Lago only charges once a payment method exists, so
 * creating the subscription first would produce a pending/unpaid subscription.
 * It is created after Lago confirms the method via the `customer.*` webhook,
 * and `accounts.subscription_tier` is moved off 'free' only when a
 * `subscription.active` event arrives. Nothing here grants a paid tier.
 *
 * LAGO_CHECKOUT_URL is intentionally gone. It was a placeholder for a
 * per-customer flow that now exists; keeping it as a fallback would quietly
 * send customers to a link with no payment method attached.
 */
export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }

  if (!isLagoConfigured()) {
    // Not an error the customer can act on, and not something to paper over
    // with a fake URL: upgrades are simply unavailable until billing is set up.
    return NextResponse.json(
      { code: "billing_unavailable", message: "Billing is not configured for this deployment." },
      { status: 503 },
    )
  }

  try {
    requireDatabaseUrl()
    const tenancy = await resolveTenancy()
    const planCode = process.env.LAGO_PLAN_CODE
    if (!planCode) {
      return NextResponse.json(
        { code: "plan_not_configured" },
        { status: 503 },
      )
    }

    const { accountId, tenantId } = tenancy
    // The account's own email, not the session's: the account row is the system
    // of record and holds the normalised value Lago will key the customer on.
    const { rows: accountRows } = await getPool().query<{ email: string }>(
      "SELECT email FROM accounts WHERE id = $1",
      [accountId],
    )
    const email = accountRows[0]?.email
    if (!email) {
      return NextResponse.json({ code: "account_not_found" }, { status: 404 })
    }

    const client = await getPool().connect()
    try {
      await client.query("BEGIN")
      await recordAudit(client, {
        tenantId,
        accountId,
        agent: "frontend-upgrade",
        action: "subscription.upgrade_requested",
      })
      await client.query("COMMIT")
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }

    await ensureLagoCustomer({ externalId: accountId, email })

    // Recorded as 'pending' intent. The unique index allows only one live row
    // per account, so a customer hammering "Upgrade" cannot accumulate pending
    // rows; the webhook moves this same row to 'active'.
    await getPool().query(
      `INSERT INTO subscriptions
         (tenant_id, account_id, lago_external_id, plan_code, external_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (lago_external_id) DO NOTHING`,
      [tenantId, accountId, `pending:${accountId}`, planCode, `sub_${accountId}`],
    )

    const { checkoutUrl } = await getCheckoutUrl(accountId)

    return NextResponse.json({
      checkoutUrl,
      // Surfaced because it is true and the customer will hit it: Lago expires
      // the link after 24 hours.
      expiresInHours: 24,
      planCode,
    })
  } catch (err) {
    return NextResponse.json({ code: "upgrade_error", message: String(err) }, { status: 422 })
  }
}

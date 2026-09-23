import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { getPool, requireDatabaseUrl } from "@/lib/db"
import { resolveTenancy } from "@/lib/tenancy"

export const dynamic = "force-dynamic"

/**
 * T040 upgrade trigger (US3, FR-011): called by the exhaustion prompt when
 * the customer hits "Upgrade". Auth required. Records the upgrade intent as
 * a tenant-scoped audit row (`subscription.upgrade_requested`) and — when a
 * checkout URL is configured (LAGO_CHECKOUT_URL) — returns it for the client
 * to open. The Lago checkout flow itself is a separate slice, so the default
 * response is `{ deferred: true }` (only the trigger, pinned Lago client).
 */
export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }
  try {
    requireDatabaseUrl()
    const tenancy = await resolveTenancy()
    await getPool().query(
      `INSERT INTO audit_log (tenant_id, account_id, agent, action, inputs, status)
       VALUES ($1, $2, 'frontend-upgrade', 'subscription.upgrade_requested', '{}', 'pending')`,
      [tenancy.tenantId, tenancy.accountId],
    )
    const checkoutUrl = process.env.LAGO_CHECKOUT_URL ?? null
    return NextResponse.json({
      deferred: true,
      url: checkoutUrl,
      message: checkoutUrl
        ? "Opening checkout…"
        : "Checkout is a separate slice — we’ve recorded your upgrade intent.",
    })
  } catch (err) {
    return NextResponse.json({ code: "upgrade_error", message: String(err) }, { status: 422 })
  }
}

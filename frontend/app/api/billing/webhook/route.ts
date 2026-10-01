import { NextResponse } from "next/server"

import { applyInvoice, applySubscription, webhookReceiptSeen } from "@/lib/billing-store"
import { getPool, requireDatabaseUrl } from "@/lib/db"
import { verifyLagoSignature, type LagoWebhookEnvelope } from "@/lib/lago"

export const dynamic = "force-dynamic"

/**
 * Lago billing webhook.
 *
 * Two things happen here that are easy to get wrong and expensive to get wrong:
 *
 * 1. The signature is checked against the RAW body, before any JSON parsing.
 *    Re-serialising a parsed object changes bytes and breaks the HMAC, so the
 *    body is read once as text and that same string is both verified and
 *    parsed.
 *
 * 2. Deliveries are de-duplicated on Lago's X-Lago-Unique-Key. This is the
 *    replay defence and it is not optional: Lago's HMAC signs the body with no
 *    timestamp, so a captured request verifies forever. Without the receipt
 *    row, anyone who ever saw one could re-apply a subscription activation
 *    indefinitely. The INSERT of the key happens in the same transaction as the
 *    effect, so the unique index rejects a concurrent duplicate and the
 *    handler can safely answer 200 (an error would just make Lago retry).
 */

/** Keeps a malformed delivery from being buffered into a 500 with a huge body. */
const MAX_BODY_BYTES = 512 * 1024

export async function POST(request: Request) {
  const hmacKey = process.env.LAGO_WEBHOOK_HMAC_KEY
  if (!hmacKey) {
    // Fail closed and loudly: an unsigned billing webhook would let anyone
    // grant themselves a paid tier by posting a subscription.activation.
    return NextResponse.json({ code: "webhook_not_configured" }, { status: 503 })
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ code: "payload_too_large" }, { status: 413 })
  }

  const verified = verifyLagoSignature(
    rawBody,
    request.headers.get("x-lago-signature"),
    hmacKey,
    "hmac",
  )
  if (!verified.ok) {
    return NextResponse.json(
      { code: "invalid_signature", detail: verified.reason },
      { status: 401 },
    )
  }

  let envelope: LagoWebhookEnvelope
  try {
    envelope = JSON.parse(rawBody) as LagoWebhookEnvelope
  } catch {
    return NextResponse.json({ code: "invalid_json" }, { status: 400 })
  }
  if (!envelope?.webhook_type) {
    return NextResponse.json({ code: "missing_webhook_type" }, { status: 400 })
  }

  // Everything below this point may open a transaction, so all shape validation
  // happens up here. Returning from inside an open transaction would hand a
  // dirty connection back to the pool and leak the lock into the next borrower.
  const isSubscription = envelope.webhook_type.startsWith("subscription.")
  const isInvoice = envelope.webhook_type.startsWith("invoice.")
  if (isSubscription && !envelope.subscription) {
    return NextResponse.json({ code: "missing_subscription_payload" }, { status: 400 })
  }
  if (isInvoice && !envelope.invoice) {
    return NextResponse.json({ code: "missing_invoice_payload" }, { status: 400 })
  }

  const uniqueKey = request.headers.get("x-lago-unique-key")
  if (!uniqueKey) {
    // Without it there is no replay defence, so this delivery is not safe to
    // act on even though it is authentic.
    return NextResponse.json({ code: "missing_unique_key" }, { status: 400 })
  }

  try {
    requireDatabaseUrl()
    if (await webhookReceiptSeen(uniqueKey)) {
      return NextResponse.json({ code: "duplicate", ignored: true })
    }
  } catch (err) {
    return NextResponse.json({ code: "webhook_error", message: String(err) }, { status: 500 })
  }

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    // Claim the key FIRST. If two deliveries of the same event race, the loser
    // hits the unique violation here and rolls back without having applied
    // anything.
    await client.query(
      `INSERT INTO billing_webhook_receipts (unique_key, webhook_type) VALUES ($1, $2)`,
      [uniqueKey, envelope.webhook_type],
    )

    const outcome = isSubscription
      ? await applySubscription(client, envelope.subscription!)
      : await applyInvoice(client, envelope.invoice!)

    if (!outcome.applied) {
      // An authentic Lago event for a customer this deployment does not know.
      // Roll the receipt back so it is not silently swallowed, and answer 202
      // so Lago does not burn retries: a local account may be provisioned
      // moments later, and re-delivery is unlikely to fix that.
      await client.query("ROLLBACK")
      return NextResponse.json(
        { code: "unknown_customer", detail: outcome.reason },
        { status: 202 },
      )
    }

    await client.query("COMMIT")
    return NextResponse.json({ code: "applied" })
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // The connection is already unusable; let release() discard it rather
      // than masking the original failure.
    }
    // A unique violation on the receipt is the concurrent-duplicate case: the
    // other delivery is applying the same event right now, so this one is done.
    if (err && typeof err === "object" && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ code: "duplicate", ignored: true })
    }
    return NextResponse.json({ code: "webhook_error", message: String(err) }, { status: 500 })
  } finally {
    client.release()
  }
}
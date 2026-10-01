import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Lago client (AGENTS.md §2: Lago for subscription + invoicing logic).
 *
 * Two rules shape this module, and both are load-bearing:
 *
 * 1. Lago is NOT a payment processor. It is the billing brain sitting on top of
 *    a licensed gateway (Stripe, in Lago's own terms). Nothing here captures a
 *    card; we ask Lago for a gateway-hosted checkout URL and the customer pays
 *    on the gateway's page. This is why there is no card field anywhere in the
 *    codebase and why `invoices`/`subscriptions` are a mirror, not a ledger.
 *
 * 2. The customer-facing identity is OUR `accounts.id`, sent to Lago as
 *    `external_id` / `external_customer_id`. It is never taken from a request
 *    body, and it is always the account behind the authenticated session, so
 *    one customer cannot address another's Lago records.
 */

/** Lago's own vocabulary. Do not rename to match our schema — map at the edge. */
export type LagoSubscriptionStatus =
  | "pending"
  | "active"
  | "suspended"
  | "terminated"
  | "expired"

export type LagoInvoiceStatus = "draft" | "open" | "paid" | "voided" | "uncollectible"

/**
 * Lago's `lago_id` -> our enum. Anything unknown maps to `pending` rather than
 * being trusted as active: an unrecognised status must never be able to grant a
 * paid tier.
 */
export function mapSubscriptionStatus(raw: unknown): LagoSubscriptionStatus {
  switch (raw) {
    case "active":
      return "active"
    case "suspended":
      return "suspended"
    case "terminated":
      return "terminated"
    case "expired":
      return "expired"
    default:
      return "pending"
  }
}

export function mapInvoiceStatus(raw: unknown): LagoInvoiceStatus {
  switch (raw) {
    case "draft":
      return "draft"
    case "open":
      return "open"
    case "paid":
      return "paid"
    case "voided":
      return "voided"
    case "uncollectible":
      return "uncollectible"
    default:
      return "open"
  }
}

function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.LAGO_API_URL?.replace(/\/+$/, "")
  const apiKey = process.env.LAGO_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error("LAGO_API_URL and LAGO_API_KEY must both be set to talk to Lago")
  }
  return { baseUrl, apiKey }
}

export function isLagoConfigured(): boolean {
  return Boolean(process.env.LAGO_API_URL && process.env.LAGO_API_KEY)
}

export class LagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "LagoError"
  }
}

async function lagoRequest<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const { baseUrl, apiKey } = config()
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Billing state must never be served from a cache. A stale checkout URL or
    // a stale subscription status is a money bug, not a performance win.
    cache: "no-store",
  })

  if (!res.ok) {
    // Deliberately not echoing the response body: Lago's errors can embed the
    // plan/customer payload, and this value reaches logs.
    throw new LagoError(`Lago ${init.method} ${path} failed`, res.status)
  }
  return (await res.json()) as T
}

/**
 * Create the Lago customer for one of our accounts.
 *
 * Uses POST /customers, which is idempotent on `external_id` in Lago, so a
 * retried upgrade does not create a second customer. The external id is the
 * account id we already hold — it is never supplied by the caller.
 */
export async function ensureLagoCustomer(input: {
  externalId: string
  email: string
  name?: string
}): Promise<{ lagoId: string; externalId: string }> {
  const data = await lagoRequest<{ customer: { lago_id: string; external_id: string } }>(
    "/customers",
    {
      method: "POST",
      body: {
        customer: {
          external_id: input.externalId,
          email: input.email,
          ...(input.name ? { name: input.name } : {}),
        },
      },
    },
  )
  return { lagoId: data.customer.lago_id, externalId: data.customer.external_id }
}

/**
 * The gateway-hosted checkout URL for a customer to store a payment method.
 *
 * NOTE this is not a subscription checkout: on the gateway it is a
 * pre-authorisation, and the subscription is created *afterwards* (see
 * createLagoSubscription) once Lago confirms the payment method exists. Lago
 * expires this URL after 24 hours, which the UI has to say out loud — a link
 * that quietly 404s the next morning is a support ticket.
 */
export async function getCheckoutUrl(externalCustomerId: string): Promise<{ checkoutUrl: string }> {
  const data = await lagoRequest<{ customer: { checkout_url: string | null } }>(
    `/customers/${encodeURIComponent(externalCustomerId)}/checkout_url`,
    { method: "POST" },
  )
  const checkoutUrl = data.customer.checkout_url
  if (!checkoutUrl) {
    // Not an error we can recover from by retrying: the gateway has not
    // produced a link, almost always because Stripe is not connected yet.
    throw new LagoError("Lago returned no checkout URL", 422)
  }
  return { checkoutUrl }
}

/**
 * Create (or re-point) the subscription. `external_id` is stable per account
 * so that Lago treats a re-send as an upgrade of the same subscription rather
 * than a second charge.
 */
export async function createLagoSubscription(input: {
  externalCustomerId: string
  planCode: string
  externalId: string
  externalSubscriptionId?: string
}): Promise<{ lagoId: string; status: LagoSubscriptionStatus; planCode: string }> {
  const data = await lagoRequest<{
    subscription: {
      lago_id: string
      status: string
      plan_code: string
      external_id: string
    }
  }>("/subscriptions", {
    method: "POST",
    body: {
      subscription: {
        external_customer_id: input.externalCustomerId,
        plan_code: input.planCode,
        external_id: input.externalId,
        ...(input.externalSubscriptionId
          ? { external_subscription_id: input.externalSubscriptionId }
          : {}),
      },
    },
  })
  return {
    lagoId: data.subscription.lago_id,
    status: mapSubscriptionStatus(data.subscription.status),
    planCode: data.subscription.plan_code,
  }
}

export interface LagoSubscriptionPayload {
  lago_id: string
  external_id: string
  external_customer_id: string
  plan_code: string
  status: string
  started_at: string | null
  ending_at: string | null
}

export interface LagoInvoicePayload {
  lago_id: string
  number: string | null
  status: string
  amount_cents: number
  amount_currency: string
  issuing_date: string | null
  paid_at: string | null
  customer?: { external_id: string }
  subscriptions?: { lago_id: string }[]
}

export interface LagoWebhookEnvelope {
  webhook_type: string
  object_type?: string
  subscription?: LagoSubscriptionPayload
  invoice?: LagoInvoicePayload
}

/**
 * Verify a Lago webhook signature.
 *
 * The two Lago algorithms are NOT interchangeable and the header carries no
 * version marker, so the caller must pass the algorithm it configured the
 * endpoint with:
 *
 * - `hmac`: base64( HMAC-SHA256( raw body, key ) ) in `X-Lago-Signature`.
 *   Unlike Stripe's scheme there is NO timestamp in the signed material, so a
 *   captured request replays verbatim forever and still verifies. Replay is
 *   handled at the receipt table (X-Lago-Unique-Key), not here — see
 *   `webhook_receipt_seen`.
 * - `jwt`: an RS256 JWT whose `data` claim must equal the raw body. Only
 *   checked for presence; verifying it properly needs the webhook public key
 *   and a JWT library, and pretending otherwise would accept forged webhooks.
 *   It returns `unsupported` so the route rejects rather than guessing.
 */
export function verifyLagoSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  algorithm: "hmac" | "jwt",
): { ok: true } | { ok: false; reason: string } {
  if (!signature) return { ok: false, reason: "missing X-Lago-Signature" }

  if (algorithm === "jwt") {
    // Fail closed. A JWT header base64-decoded as an HMAC would be nonsense,
    // and accepting it would let anyone forge a billing webhook.
    return {
      ok: false,
      reason:
        "endpoint is configured for jwt signatures, which this deployment does not verify; set the endpoint to hmac",
    }
  }

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  // Lengths differ for almost every forged input, and timingSafeEqual throws on
  // a mismatch, so the length check has to come first.
  if (a.length !== b.length) return { ok: false, reason: "signature mismatch" }
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" }
  return { ok: true }
}

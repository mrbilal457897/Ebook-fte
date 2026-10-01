import { createHmac } from "node:crypto"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  mapInvoiceStatus,
  mapSubscriptionStatus,
  verifyLagoSignature,
} from "@/lib/lago"
import { triggerUpgrade } from "@/lib/upgrade"

/**
 * Lago webhook verification and status mapping.
 *
 * This is the security boundary for billing: anything that gets past it can set
 * a customer's `subscription_tier`. The tests below are mostly about what the
 * handler must REFUSE, because the failure modes are asymmetric — a rejected
 * real webhook is an inconvenience, an accepted forged one is revenue.
 */

const SECRET = "lagohmackey_do_not_use_in_prod"
const BODY = JSON.stringify({
  webhook_type: "subscription.created",
  object_type: "subscription",
  subscription: {
    lago_id: "b7fab1a8-7395-457a-966d-3547b0da5a6f",
    external_id: "sub_2f6a",
    external_customer_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    plan_code: "pro",
    status: "active",
    started_at: "2026-10-01T00:00:00Z",
    ending_at: null,
  },
})

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64")
}

describe("verifyLagoSignature — hmac", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyLagoSignature(BODY, sign(BODY), SECRET, "hmac")).toEqual({ ok: true })
  })

  it("rejects a missing signature header", () => {
    expect(verifyLagoSignature(BODY, null, SECRET, "hmac")).toEqual({
      ok: false,
      reason: "missing X-Lago-Signature",
    })
  })

  it("rejects a body that was altered after signing", () => {
    const signature = sign(BODY)
    const tampered = BODY.replace('"plan_code":"pro"', '"plan_code":"enterprise"')
    const result = verifyLagoSignature(tampered, signature, SECRET, "hmac")
    expect(result.ok).toBe(false)
  })

  it("rejects a signature made with a different secret", () => {
    expect(verifyLagoSignature(BODY, sign(BODY, "wrong-secret"), SECRET, "hmac").ok).toBe(false)
  })

  it("rejects a hex signature, which is Stripe's format and not Lago's", () => {
    // The single most likely integration bug: copying a Stripe-style
    // verifier. A hex digest must not be accepted here.
    const hex = createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex")
    expect(verifyLagoSignature(BODY, hex, SECRET, "hmac").ok).toBe(false)
  })

  it("rejects a signature of a different length without throwing", () => {
    // timingSafeEqual throws on length mismatch; the length guard has to come
    // first or a malformed header becomes a 500 instead of a 401.
    const result = verifyLagoSignature(BODY, "short", SECRET, "hmac")
    expect(result).toEqual({ ok: false, reason: "signature mismatch" })
  })

  it("rejects an empty signature", () => {
    expect(verifyLagoSignature(BODY, "", SECRET, "hmac").ok).toBe(false)
  })

  it("is byte-exact: re-serialised JSON must not verify", () => {
    // Why the route must verify the raw text and not a re-serialised object.
    const reordered = JSON.stringify(JSON.parse(BODY), null, 2)
    expect(verifyLagoSignature(reordered, sign(BODY), SECRET, "hmac").ok).toBe(false)
  })
})

describe("verifyLagoSignature — jwt endpoints fail closed", () => {
  it("refuses a jwt-configured endpoint instead of guessing", () => {
    // Verifying RS256 needs the webhook public key and a JWT library. Silently
    // skipping that check would accept forged billing webhooks.
    const result = verifyLagoSignature(BODY, "anything", SECRET, "jwt")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/does not verify/)
  })

  it("does not accept a base64 HMAC on a jwt endpoint", () => {
    expect(verifyLagoSignature(BODY, sign(BODY), SECRET, "jwt").ok).toBe(false)
  })
})

describe("mapSubscriptionStatus", () => {
  it.each(["active", "suspended", "terminated", "expired"] as const)(
    "passes %s through",
    (s) => {
      expect(mapSubscriptionStatus(s)).toBe(s)
    },
  )

  it("maps an unknown or missing status to pending, never to active", () => {
    // An unrecognised provider status must not be able to grant a paid tier.
    expect(mapSubscriptionStatus("trialing")).toBe("pending")
    expect(mapSubscriptionStatus(undefined)).toBe("pending")
    expect(mapSubscriptionStatus(null)).toBe("pending")
    expect(mapSubscriptionStatus(42)).toBe("pending")
    expect(mapSubscriptionStatus("ACTIVE")).toBe("pending")
  })
})

describe("mapInvoiceStatus", () => {
  it.each(["draft", "open", "paid", "voided", "uncollectible"] as const)(
    "passes %s through",
    (s) => {
      expect(mapInvoiceStatus(s)).toBe(s)
    },
  )

  it("falls back to open for an unknown status", () => {
    expect(mapInvoiceStatus("weird")).toBe("open")
    expect(mapInvoiceStatus(undefined)).toBe("open")
  })
})

describe("triggerUpgrade", () => {
  function mockResponse(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: status < 400, status, json: async () => body })),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the checkout URL on success", async () => {
    mockResponse(200, { checkoutUrl: "https://pay.example/x", expiresInHours: 24 })
    const result = await triggerUpgrade()
    expect(result).toEqual({
      ok: true,
      checkoutUrl: "https://pay.example/x",
      expiresInHours: 24,
    })
  })

  it("surfaces a 503 as a failure, not a success with a null URL", async () => {
    // The old client treated any 2xx-with-deferred as success and reported
    // "Checkout is on its way" even when no URL existed.
    mockResponse(503, { code: "billing_unavailable" })
    const result = await triggerUpgrade()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/aren’t available/)
  })

  it("does not report success when 200 carries no checkoutUrl", async () => {
    mockResponse(200, { message: "nope" })
    expect((await triggerUpgrade()).ok).toBe(false)
  })

  it("survives a non-JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json")
        },
      })),
    )
    expect((await triggerUpgrade()).ok).toBe(false)
  })
})

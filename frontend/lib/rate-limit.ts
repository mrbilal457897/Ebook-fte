import { createHash } from "crypto"

/**
 * Rate-limit scope keys (T016). Device fingerprint + client IP are hashed
 * to SHA-256 so the Orchestrator never sees raw identifiers (contracts/
 * orchestrator-api.md `rateLimitContext`; Article IV.5 "never raw"). The
 * Orchestrator then enforces per-(kind, scope_key, window) thresholds from
 * its own config. This file only MAKES the keys at the Next.js boundary —
 * it never stores or logs them.
 */

export function hashScopeKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

/**
 * Build the `rateLimitContext` payload for the internal contract.
 * `x-real-ip` / `x-forwarded-for` are read from the request (proxied set by
 * the platform/uvicorn in front); `deviceKey` rests on a stable browser
 * fingerprint passed from the client.
 */
export function buildRateLimitContext(input: { clientIp: string; deviceFingerprint: string }): {
  deviceKey: string
  clientIpKey: string
} {
  return {
    deviceKey: hashScopeKey(input.deviceFingerprint),
    clientIpKey: hashScopeKey(input.clientIp),
  }
}

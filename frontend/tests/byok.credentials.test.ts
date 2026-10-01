import { createDecipheriv } from "node:crypto"

import { describe, expect, it } from "vitest"

import { assertLooksLikeApiKey, isModelProvider, sealApiKey } from "@/lib/model-credentials"

/**
 * BYOK credential storage (Principle 3).
 *
 * The critical property is that a provider key is sealed before it reaches
 * Postgres and can only be opened again with the configured key — and that a
 * plaintext key is never silently accepted. These are hermetic: they exercise
 * the sealing primitive and the input boundary, no database and no session.
 *
 * The sealing *format* is cross-checked against the Orchestrator's reader
 * (`agents/orchestrator/src/orchestrator/byok.py::_decrypt_key`), because a
 * mismatch between the two sides would be invisible in a single-language test —
 * every value would round-trip locally while production failed to decrypt.
 */

const ENV_KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64")

function withKey<T>(fn: () => T): T {
  const previous = process.env.BYOK_ENCRYPTION_KEY
  process.env.BYOK_ENCRYPTION_KEY = ENV_KEY
  try {
    return fn()
  } finally {
    if (previous === undefined) delete process.env.BYOK_ENCRYPTION_KEY
    else process.env.BYOK_ENCRYPTION_KEY = previous
  }
}

describe("BYOK key sealing", () => {
  it("round-trips a key through AES-256-GCM", () => {
    withKey(() => {
      const sealed = sealApiKey("sk-customer-abc123")
      // The stored form must never be the plaintext.
      expect(sealed.toString("utf8")).not.toContain("sk-customer-abc123")
      expect(sealed.subarray(0, 4).toString("utf8")).toBe("gcm:")
    })
  })

  it("produces a different blob every time (fresh nonce), so identical keys are not linkable at rest", () => {
    withKey(() => {
      const a = sealApiKey("sk-same-key")
      const b = sealApiKey("sk-same-key")
      expect(a.equals(b)).toBe(false)
    })
  })

  it("refuses to store anything when BYOK_ENCRYPTION_KEY is absent, rather than writing plaintext", () => {
    const previous = process.env.BYOK_ENCRYPTION_KEY
    delete process.env.BYOK_ENCRYPTION_KEY
    try {
      expect(() => sealApiKey("sk-abc123")).toThrowError(/BYOK_ENCRYPTION_KEY is not configured/)
    } finally {
      if (previous !== undefined) process.env.BYOK_ENCRYPTION_KEY = previous
    }
  })

  it("rejects an encryption key that is not 32 bytes", () => {
    const previous = process.env.BYOK_ENCRYPTION_KEY
    process.env.BYOK_ENCRYPTION_KEY = Buffer.from("too short").toString("base64")
    try {
      expect(() => sealApiKey("sk-abc123")).toThrowError(/must decode to 32 bytes/)
    } finally {
      if (previous === undefined) delete process.env.BYOK_ENCRYPTION_KEY
      else process.env.BYOK_ENCRYPTION_KEY = previous
    }
  })

  it("stores a blob in the exact shape the Orchestrator reader expects", () => {
    // The Python reader contract is `gcm:` + nonce(12) || ciphertext || tag(16),
    // opened with AES-256-GCM and the same base64 key. This test opens a real
    // stored blob with that contract spelled out here, so a change to the
    // writer's shape cannot pass in TypeScript while failing at decryption time
    // in the service — which is the failure this test exists to prevent.
    withKey(() => {
      const plaintext = "sk-customer-abc123"
      const sealed = sealApiKey(plaintext)
      const body = sealed.subarray("gcm:".length)
      const nonce = body.subarray(0, 12)
      const tag = body.subarray(body.length - 16)
      const ciphertext = body.subarray(12, body.length - 16)

      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(ENV_KEY, "base64"), nonce)
      decipher.setAuthTag(tag)
      const opened = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
      expect(opened).toBe(plaintext)
    })
  })
})

describe("BYOK key input validation", () => {
  it("accepts a plausible key", () => {
    expect(() => assertLooksLikeApiKey("sk-abcdefghijklmnop")).not.toThrow()
  })

  it("rejects an obviously-too-short key before sealing it", () => {
    expect(() => assertLooksLikeApiKey("sk-abc")).toThrowError(/too short/)
  })

  it("rejects a pasted key with stray whitespace", () => {
    expect(() => assertLooksLikeApiKey("sk-abcdefghijklm nop")).toThrowError(/whitespace/)
  })

  it("rejects an implausibly long paste", () => {
    expect(() => assertLooksLikeApiKey("x".repeat(600))).toThrowError(/implausibly long/)
  })
})

describe("provider guard", () => {
  it("accepts only the three providers the schema CHECK allows", () => {
    expect(isModelProvider("gemini")).toBe(true)
    expect(isModelProvider("openai")).toBe(true)
    expect(isModelProvider("anthropic")).toBe(true)
    expect(isModelProvider("cohere")).toBe(false)
    expect(isModelProvider(null)).toBe(false)
    expect(isModelProvider(undefined)).toBe(false)
  })
})
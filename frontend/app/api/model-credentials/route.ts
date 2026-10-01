import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import {
  ByokEncryptionUnavailable,
  assertLooksLikeApiKey,
  deleteCredential,
  isModelProvider,
  listCredentials,
  saveCredential,
  setActiveCredential,
} from "@/lib/model-credentials"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * BYOK credential management (Principle 3: BYOK first-class, encrypted at rest).
 *
 * This is the write path that did not exist: `model_credentials` was readable
 * and `accounts.active_byok_credential_id` was resolvable, but nothing ever
 * created a row or set the pointer, so a customer's own key could never be used.
 *
 * The key arrives in this request body, is sealed with AES-256-GCM immediately,
 * and is never returned over the wire again — `GET` returns ids and providers
 * only. `tenant_id`/`account_id` are derived from the session in
 * `lib/model-credentials.ts`, never taken from the body (Article IV.5).
 */
async function requireSession() {
  const session = await getSession()
  return session?.user?.id ? session : null
}

export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ code: "signed_out" }, { status: 401 })
  try {
    return NextResponse.json({ credentials: await listCredentials() })
  } catch (err) {
    return NextResponse.json({ code: "byok_error", message: String(err) }, { status: 500 })
  }
}

/** Store a key and make it active. `{ provider, apiKey, activate? }` */
export async function POST(req: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ code: "signed_out" }, { status: 401 })

  let body: { provider?: unknown; apiKey?: unknown; activate?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: "invalid_body" }, { status: 400 })
  }

  if (!isModelProvider(body.provider)) {
    return NextResponse.json(
      { code: "unsupported_provider", message: "Provider must be gemini, openai or anthropic" },
      { status: 400 },
    )
  }
  if (typeof body.apiKey !== "string") {
    return NextResponse.json({ code: "invalid_body", message: "apiKey is required" }, { status: 400 })
  }

  try {
    assertLooksLikeApiKey(body.apiKey)
    const stored = await saveCredential({ provider: body.provider, apiKey: body.apiKey })
    // A newly saved key is active by default: the customer added it to use it.
    if (body.activate === false) await setActiveCredential(null)
    return NextResponse.json({ credential: stored }, { status: 201 })
  } catch (err) {
    if (err instanceof ByokEncryptionUnavailable) {
      // A 503, not a 500: the request was well-formed, the service is not
      // configured to store keys safely yet.
      return NextResponse.json({ code: "byok_not_configured", message: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : String(err)
    const looksLikeInputProblem =
      message.includes("too short") || message.includes("too long") || message.includes("whitespace")
    return NextResponse.json(
      { code: looksLikeInputProblem ? "invalid_api_key" : "byok_error", message },
      { status: looksLikeInputProblem ? 400 : 500 },
    )
  }
}

/** Activate an existing credential, or `{ credentialId: null }` to fall back
 *  to the platform key. */
export async function PATCH(req: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ code: "signed_out" }, { status: 401 })
  let body: { credentialId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: "invalid_body" }, { status: 400 })
  }
  if (body.credentialId !== null && typeof body.credentialId !== "string") {
    return NextResponse.json({ code: "invalid_body" }, { status: 400 })
  }
  try {
    const changed = await setActiveCredential(body.credentialId as string | null)
    if (!changed) {
      // Either the id belongs to another account/tenant, or it does not exist.
      // Both are reported the same way so this endpoint cannot be used to probe
      // for other tenants' credential ids.
      return NextResponse.json({ code: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ code: "byok_error", message: String(err) }, { status: 500 })
  }
}

/** Delete a credential. `{ credentialId }` */
export async function DELETE(req: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ code: "signed_out" }, { status: 401 })
  let body: { credentialId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: "invalid_body" }, { status: 400 })
  }
  if (typeof body.credentialId !== "string") {
    return NextResponse.json({ code: "invalid_body" }, { status: 400 })
  }
  try {
    const removed = await deleteCredential(body.credentialId)
    if (!removed) return NextResponse.json({ code: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ code: "byok_error", message: String(err) }, { status: 500 })
  }
}
import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { onFirstSignIn } from "@/lib/auth/tenant-link"

/**
 * First-sign-in linkage endpoint (T022 seam). Server-only: binds the
 * authenticated session's user to the tenant entry point they arrived
 * through. The slug comes from the entry URL; the auth-subject/email come
 * from the session, never from the client (Article IV.5). Idempotent —
 * safe to call on every successful arrival.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }

  let tenantSlug: string
  try {
    const body = (await req.json()) as { tenantSlug?: string }
    tenantSlug = (body.tenantSlug ?? "").trim()
  } catch {
    return NextResponse.json({ code: "invalid_prompt" }, { status: 400 })
  }
  if (!tenantSlug) {
    return NextResponse.json({ code: "invalid_prompt" }, { status: 400 })
  }

  try {
    const result = await onFirstSignIn({
      tenantSlug,
      authSubject: session.user.id,
      email: session.user.email ?? "",
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ code: "tenant_link_failed", message: String(err) }, { status: 422 })
  }
}

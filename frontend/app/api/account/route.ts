import { NextResponse } from "next/server"

import { getAccountInfo } from "@/lib/account-info"
import { getSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * T033 `GET /api/account`: auth-required allowance / in-flight / BYOK-status
 * read (contracts/generation-api.md §GET /api/account). Drives the allowance
 * display, the US3 exhaustion/upgrade prompt, and cross-device in-flight
 * state. Tenant/account derive from the session (never the body).
 */
export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }
  try {
    return NextResponse.json(await getAccountInfo())
  } catch (err) {
    return NextResponse.json({ code: "account_error", message: String(err) }, { status: 422 })
  }
}

import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"

/**
 * US1 auth gate (T023), enforced in the route handler, never middleware-only
 * (CVE-2025-29927 note; research.md §1). Signed-out → 401 signed_out with no
 * rows created and no model call (FR-001, AC1). Streaming proxy logic lands
 * with US2 (T035).
 */
export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }
  return NextResponse.json({ code: "not_implemented" }, { status: 501 })
}

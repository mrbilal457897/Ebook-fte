import { NextResponse } from "next/server"

import { getSavedContent } from "@/lib/account-info"
import { getSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * T044 `GET /api/generation/[id]`: re-fetches saved content after an
 * interruption (AC4, contracts/generation-api.md §GET). Auth required;
 * `404` when the version is not in the caller's tenant. Returns
 * { versionId, bookId, conversationId, content, isPartial, updatedAt }.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ code: "signed_out" }, { status: 401 })
  }
  const { id } = await params
  const saved = await getSavedContent(id)
  if (saved === null) {
    return NextResponse.json({ code: "not_found" }, { status: 404 })
  }
  return NextResponse.json({
    versionId: saved.versionId,
    bookId: saved.bookId,
    conversationId: saved.conversationId,
    content: saved.content,
    isPartial: saved.isPartial,
    updatedAt: saved.updatedAt,
  })
}

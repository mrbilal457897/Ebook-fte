import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ code: "not_implemented" }, { status: 501 })
}

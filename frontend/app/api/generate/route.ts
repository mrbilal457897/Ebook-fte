import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ code: "not_implemented" }, { status: 501 });
}
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!checkPassword(String(password || ""))) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  createSession();
  return NextResponse.json({ ok: true });
}

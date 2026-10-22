import { NextRequest, NextResponse } from "next/server";
import { getCdk } from "@/lib/cdk";

export const runtime = "nodejs";

// 验证 CDK 是否可用（未使用、未禁用）
export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "请输入 CDK" }, { status: 400 });
  }
  const row = getCdk(code);
  if (!row) return NextResponse.json({ ok: false, error: "CDK 不存在" }, { status: 404 });
  if (row.status === "disabled")
    return NextResponse.json({ ok: false, error: "该 CDK 已被禁用" }, { status: 400 });
  if (row.status === "used")
    return NextResponse.json({ ok: false, error: "该 CDK 已被使用" }, { status: 400 });

  return NextResponse.json({ ok: true, code: row.code });
}

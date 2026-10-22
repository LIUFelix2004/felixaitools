import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { createBatch, getCdk } from "@/lib/cdk";

export const runtime = "nodejs";

// 列出 CDK + 统计
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare(`SELECT code, status, source, order_id, created_at, used_at FROM cdks ORDER BY created_at DESC LIMIT 500`)
    .all();
  const stats = db.prepare(`SELECT status, COUNT(*) n FROM cdks GROUP BY status`).all() as {
    status: string;
    n: number;
  }[];
  const counts: Record<string, number> = { unused: 0, used: 0, disabled: 0 };
  for (const s of stats) counts[s.status] = s.n;
  return NextResponse.json({ items: rows, counts });
}

// 批量手动生成 CDK
export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { count } = await req.json().catch(() => ({ count: 1 }));
  const n = Math.max(1, Math.min(Number(count) || 1, 500));
  const codes = createBatch(n);
  return NextResponse.json({ ok: true, codes });
}

// 禁用 / 启用一张 CDK
export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { code, action } = await req.json().catch(() => ({}));
  const row = getCdk(String(code || ""));
  if (!row) return NextResponse.json({ error: "CDK 不存在" }, { status: 404 });
  if (row.status === "used")
    return NextResponse.json({ error: "已使用的 CDK 不能改状态" }, { status: 400 });
  const next = action === "disable" ? "disabled" : "unused";
  db.prepare(`UPDATE cdks SET status = ? WHERE code = ?`).run(next, row.code);
  return NextResponse.json({ ok: true, status: next });
}

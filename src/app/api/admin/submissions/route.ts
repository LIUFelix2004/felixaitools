import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// 管理员：提交列表（可按状态过滤 + 关键字搜索）+ 统计
export async function GET(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || "all";
  const kw = (req.nextUrl.searchParams.get("q") || "").trim();

  const where: string[] = [];
  const args: any[] = [];
  if (status !== "all") {
    where.push("s.status = ?");
    args.push(status);
  }
  if (kw) {
    where.push("(s.email LIKE ? OR s.cdk_code LIKE ? OR s.contact LIKE ?)");
    args.push(`%${kw}%`, `%${kw.toUpperCase()}%`, `%${kw}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM files f WHERE f.submission_id = s.id) AS file_count
       FROM submissions s ${whereSql}
       ORDER BY s.created_at DESC LIMIT 500`
    )
    .all(...args) as any[];

  const stats = db
    .prepare(`SELECT status, COUNT(*) AS n FROM submissions GROUP BY status`)
    .all() as { status: string; n: number }[];

  const counts: Record<string, number> = { all: 0, pending: 0, processing: 0, success: 0, failed: 0 };
  for (const s of stats) {
    counts[s.status] = s.n;
    counts.all += s.n;
  }

  return NextResponse.json({
    counts,
    items: rows.map((r) => ({
      id: r.id,
      cdk: r.cdk_code,
      email: r.email,
      contact: r.contact,
      note: r.note,
      status: r.status,
      adminNote: r.admin_note,
      fileCount: r.file_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

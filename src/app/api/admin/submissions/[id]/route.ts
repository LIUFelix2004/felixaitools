import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

const VALID = new Set(["pending", "processing", "success", "failed"]);

// 查看单条详情（含文件列表）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const s = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(params.id) as any;
  if (!s) return NextResponse.json({ error: "不存在" }, { status: 404 });
  const files = db
    .prepare(`SELECT id, original_name, size, mime, created_at FROM files WHERE submission_id = ?`)
    .all(params.id);
  return NextResponse.json({ submission: s, files });
}

// 更新状态 / 管理员备注
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const args: any[] = [];

  if (typeof body.status === "string") {
    if (!VALID.has(body.status))
      return NextResponse.json({ error: "无效状态" }, { status: 400 });
    sets.push("status = ?");
    args.push(body.status);
  }
  if (typeof body.adminNote === "string") {
    sets.push("admin_note = ?");
    args.push(body.adminNote);
  }
  if (sets.length === 0) return NextResponse.json({ error: "无更新内容" }, { status: 400 });

  sets.push("updated_at = ?");
  args.push(Date.now(), params.id);
  const r = db.prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  if (r.changes === 0) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

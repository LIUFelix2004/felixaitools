import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { storedPath } from "@/lib/storage";

export const runtime = "nodejs";

// 管理员下载某个提交文件
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const f = db
    .prepare(`SELECT stored_name, original_name, mime FROM files WHERE id = ?`)
    .get(params.id) as { stored_name: string; original_name: string; mime: string } | undefined;
  if (!f) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const p = storedPath(f.stored_name);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "文件已丢失" }, { status: 410 });

  const data = await fs.promises.readFile(p);
  const filename = encodeURIComponent(f.original_name);
  return new NextResponse(data as any, {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

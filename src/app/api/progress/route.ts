import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatCode } from "@/lib/cdk";

export const runtime = "nodejs";

const LABEL: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  success: "已完成",
  failed: "已失败",
};

// 按 CDK 或邮箱查询提交进度
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "请输入 CDK 或邮箱" }, { status: 400 });

  const byCode = formatCode(q);
  const rows = db
    .prepare(
      `SELECT id, cdk_code, email, status, admin_note, created_at, updated_at
       FROM submissions
       WHERE cdk_code = ? OR email = ?
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(byCode, q.toLowerCase()) as any[];

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      email: maskEmail(r.email),
      cdk: maskCode(r.cdk_code),
      status: r.status,
      statusLabel: LABEL[r.status] ?? r.status,
      adminNote: r.admin_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

function maskEmail(e: string) {
  const [name, domain] = e.split("@");
  if (!domain) return e;
  const head = name.slice(0, Math.min(3, name.length));
  return `${head}***@${domain}`;
}
function maskCode(c: string) {
  return "****" + c.replace(/-/g, "").slice(-4);
}

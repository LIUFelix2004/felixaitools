import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderDetail } from "@/lib/shop";

export const runtime = "nodejs";

// 订单查询：按订单号精确，或按邮箱列出最近订单
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "请输入订单号或邮箱" }, { status: 400 });

  // 订单号直查
  if (/^NO[A-Z0-9]+$/i.test(q)) {
    const d = orderDetail(q.toUpperCase());
    return NextResponse.json({ items: d ? [d] : [] });
  }

  // 邮箱列出
  const rows = db
    .prepare(`SELECT id FROM orders WHERE email = ? ORDER BY created_at DESC LIMIT 20`)
    .all(q.toLowerCase()) as { id: string }[];
  const items = rows.map((r) => orderDetail(r.id)).filter(Boolean);
  return NextResponse.json({ items });
}

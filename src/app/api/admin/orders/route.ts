import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// 订单列表 + 统计（可按状态/类型过滤 + 关键字）
export async function GET(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") || "all";
  const kw = (req.nextUrl.searchParams.get("q") || "").trim();

  const where: string[] = [];
  const args: any[] = [];
  if (status === "paid" || status === "pending") {
    where.push("status = ?");
    args.push(status);
  }
  if (kw) {
    where.push("(email LIKE ? OR id LIKE ? OR product_name LIKE ?)");
    args.push(`%${kw}%`, `%${kw.toUpperCase()}%`, `%${kw}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db.prepare(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT 500`).all(...args) as any[];

  const stat = db.prepare(`SELECT status, COUNT(*) n, SUM(amount) amt FROM orders GROUP BY status`).all() as any[];
  const counts: Record<string, number> = { all: 0, pending: 0, paid: 0 };
  let revenue = 0;
  for (const s of stat) {
    counts[s.status] = s.n;
    counts.all += s.n;
    if (s.status === "paid") revenue = s.amt || 0;
  }

  return NextResponse.json({
    counts,
    revenue,
    items: rows.map((o) => ({
      id: o.id,
      productName: o.product_name,
      productType: o.product_type,
      quantity: o.quantity,
      amount: o.amount,
      email: o.email,
      contact: o.contact,
      status: o.status,
      createdAt: o.created_at,
      paidAt: o.paid_at,
    })),
  });
}

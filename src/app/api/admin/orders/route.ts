import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { shipOrder } from "@/lib/shop";

export const runtime = "nodejs";

// 订单列表 + 统计（可按状态过滤 + 关键字）
// status: all | paid | pending | waiting(已支付待发货)
export async function GET(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") || "all";
  const kw = (req.nextUrl.searchParams.get("q") || "").trim();

  const where: string[] = [];
  const args: any[] = [];
  if (status === "paid" || status === "pending") {
    where.push("status = ?");
    args.push(status);
  } else if (status === "waiting") {
    where.push("status = 'paid' AND ship_status = 'waiting'");
  }
  if (kw) {
    where.push("(contact LIKE ? OR email LIKE ? OR id LIKE ? OR product_name LIKE ?)");
    args.push(`%${kw}%`, `%${kw}%`, `%${kw.toUpperCase()}%`, `%${kw}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db.prepare(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT 500`).all(...args) as any[];

  const stat = db.prepare(`SELECT status, COUNT(*) n, SUM(amount) amt FROM orders GROUP BY status`).all() as any[];
  const counts: Record<string, number> = { all: 0, pending: 0, paid: 0, waiting: 0 };
  let revenue = 0;
  for (const s of stat) {
    counts[s.status] = s.n;
    counts.all += s.n;
    if (s.status === "paid") revenue = s.amt || 0;
  }
  counts.waiting = (
    db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'paid' AND ship_status = 'waiting'`).get() as any
  ).n;

  return NextResponse.json({
    counts,
    revenue,
    items: rows.map((o) => ({
      id: o.id,
      productName: o.product_name,
      productType: o.product_type,
      quantity: o.quantity,
      amount: o.amount,
      contact: o.contact,
      email: o.email,
      status: o.status,
      shipStatus: o.ship_status,
      cardContent: o.card_content,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      shippedAt: o.shipped_at,
    })),
  });
}

// 人工发货：{ id, content }
export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, content } = await req.json().catch(() => ({}));
  const text = String(content || "").trim();
  if (!id || !text) return NextResponse.json({ error: "请填写卡密内容" }, { status: 400 });
  try {
    shipOrder(String(id), text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "发货失败" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, tx } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// 查看某商品的卡密库存
export async function GET(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "缺少 productId" }, { status: 400 });
  const counts = db
    .prepare(`SELECT status, COUNT(*) n FROM cards WHERE product_id = ? GROUP BY status`)
    .all(productId) as { status: string; n: number }[];
  const c: Record<string, number> = { unused: 0, sold: 0 };
  for (const r of counts) c[r.status] = r.n;
  const recent = db
    .prepare(`SELECT id, content, status, created_at, sold_at FROM cards WHERE product_id = ? ORDER BY created_at DESC LIMIT 100`)
    .all(productId);
  return NextResponse.json({ counts: c, items: recent });
}

// 批量导入卡密（每行一条）
export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { productId, content } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "缺少 productId" }, { status: 400 });
  const prod = db.prepare(`SELECT type FROM products WHERE id = ?`).get(productId) as { type: string } | undefined;
  if (!prod) return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  if (prod.type !== "card")
    return NextResponse.json({ error: "只有「秒发卡密」类商品需要导入库存" }, { status: 400 });

  const lines = String(content || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return NextResponse.json({ error: "没有可导入的卡密" }, { status: 400 });

  const now = Date.now();
  const ins = db.prepare(
    `INSERT INTO cards (id, product_id, content, status, created_at) VALUES (?, ?, ?, 'unused', ?)`
  );
  tx(() => {
    for (const line of lines) ins.run(nanoid(12), productId, line, now);
  });
  return NextResponse.json({ ok: true, added: lines.length });
}

// 删除一张未售卡密
export async function DELETE(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const r = db.prepare(`DELETE FROM cards WHERE id = ? AND status = 'unused'`).run(id);
  if (Number(r.changes) === 0) return NextResponse.json({ error: "已售出或不存在，不能删除" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

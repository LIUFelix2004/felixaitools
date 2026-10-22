import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { stockOf } from "@/lib/shop";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.sort, p.created_at`
    )
    .all() as any[];
  return NextResponse.json({
    items: rows.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      categoryName: p.category_name,
      name: p.name,
      description: p.description,
      price: p.price,
      type: p.type,
      status: p.status,
      sort: p.sort,
      stock: p.type === "card" ? stockOf(p.id) : null,
      soldCount:
        (db.prepare(`SELECT COUNT(*) n FROM orders WHERE product_id = ? AND status = 'paid'`).get(p.id) as any).n,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.name || b.price == null) return NextResponse.json({ error: "请填写商品名和价格" }, { status: 400 });
  const type = b.type === "file" ? "file" : "card";
  const id = "P" + nanoid(10);
  db.prepare(
    `INSERT INTO products (id, category_id, name, description, price, type, status, sort, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.categoryId || null,
    String(b.name),
    b.description ? String(b.description) : null,
    Number(b.price),
    type,
    b.status === "off" ? "off" : "on",
    Number(b.sort) || 0,
    Date.now()
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const fields: string[] = [];
  const args: any[] = [];
  const set = (col: string, val: any) => {
    fields.push(`${col} = ?`);
    args.push(val);
  };
  if (b.name != null) set("name", String(b.name));
  if (b.categoryId !== undefined) set("category_id", b.categoryId || null);
  if (b.description !== undefined) set("description", b.description ? String(b.description) : null);
  if (b.price != null) set("price", Number(b.price));
  if (b.type != null) set("type", b.type === "file" ? "file" : "card");
  if (b.status != null) set("status", b.status === "off" ? "off" : "on");
  if (b.sort != null) set("sort", Number(b.sort));
  if (fields.length === 0) return NextResponse.json({ error: "无更新内容" }, { status: 400 });

  args.push(b.id);
  db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  // 下架即可；有卖出记录时不物理删除，避免订单失联
  const sold = db.prepare(`SELECT COUNT(*) n FROM orders WHERE product_id = ?`).get(id) as { n: number };
  if (Number(sold.n) > 0) {
    db.prepare(`UPDATE products SET status = 'off' WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true, softDeleted: true });
  }
  db.prepare(`DELETE FROM cards WHERE product_id = ?`).run(id);
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}

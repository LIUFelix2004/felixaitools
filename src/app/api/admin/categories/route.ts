import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ORDER BY sort, created_at`
    )
    .all();
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { name, sort } = await req.json().catch(() => ({}));
  if (!name) return NextResponse.json({ error: "请填写分类名" }, { status: 400 });
  const id = "C" + nanoid(10);
  db.prepare(`INSERT INTO categories (id, name, sort, created_at) VALUES (?, ?, ?, ?)`).run(
    id,
    String(name),
    Number(sort) || 0,
    Date.now()
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, name, sort } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  db.prepare(`UPDATE categories SET name = COALESCE(?, name), sort = COALESCE(?, sort) WHERE id = ?`).run(
    name ?? null,
    sort ?? null,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const used = db.prepare(`SELECT COUNT(*) n FROM products WHERE category_id = ?`).get(id) as { n: number };
  if (Number(used.n) > 0)
    return NextResponse.json({ error: "该分类下还有商品，请先移走" }, { status: 400 });
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}

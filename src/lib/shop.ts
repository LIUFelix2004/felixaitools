import { nanoid } from "nanoid";
import { db, tx } from "./db";
import { createCdk } from "./cdk";

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  type: "card" | "file";
  status: "on" | "off";
  sort: number;
  created_at: number;
};

/** 某 card 商品的可用库存数（file 商品返回 null，表示不限量） */
export function stockOf(productId: string): number {
  const r = db
    .prepare(`SELECT COUNT(*) AS n FROM cards WHERE product_id = ? AND status = 'unused'`)
    .get(productId) as { n: number };
  return Number(r.n);
}

/** 公开目录：分类 + 上架商品（card 商品带库存） */
export function catalog() {
  const cats = db.prepare(`SELECT * FROM categories ORDER BY sort, created_at`).all() as any[];
  const prods = db
    .prepare(`SELECT * FROM products WHERE status = 'on' ORDER BY sort, created_at`)
    .all() as Product[];
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
    products: prods.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description,
      price: p.price,
      type: p.type,
      stock: p.type === "card" ? stockOf(p.id) : null,
    })),
  };
}

export function getProduct(id: string): Product | undefined {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as Product | undefined;
}

/** 下单（含校验）：返回订单 id 与应付金额 */
export function createOrder(input: {
  productId: string;
  quantity: number;
  email: string;
  contact?: string;
  provider: string;
}) {
  const p = getProduct(input.productId);
  if (!p || p.status !== "on") throw new Error("商品不存在或已下架");
  const qty = Math.max(1, Math.min(Math.floor(input.quantity || 1), 100));

  if (p.type === "card") {
    const stock = stockOf(p.id);
    if (stock < qty) throw new Error(`库存不足，当前仅剩 ${stock} 件`);
  }

  const amount = Math.round(p.price * qty * 100) / 100;
  const id = "NO" + nanoid(14).toUpperCase();
  db.prepare(
    `INSERT INTO orders
       (id, product_id, product_name, product_type, unit_price, quantity, amount, email, contact, status, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    p.id,
    p.name,
    p.type,
    p.price,
    qty,
    amount,
    input.email,
    input.contact ?? null,
    input.provider,
    Date.now()
  );
  return { orderId: id, amount, productType: p.type, productName: p.name };
}

/**
 * 支付成功后发货（幂等）：
 * - card 商品：从库存池占用 qty 张卡密，绑定到订单
 * - file 商品：生成 qty 张 CDK，绑定到订单
 */
export function fulfillOrder(orderId: string, payRef?: string): boolean {
  return tx(() => {
    const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as any;
    if (!o) return false;
    if (o.status === "paid") return true; // 幂等

    if (o.product_type === "card") {
      const avail = db
        .prepare(`SELECT id FROM cards WHERE product_id = ? AND status = 'unused' ORDER BY created_at LIMIT ?`)
        .all(o.product_id, o.quantity) as { id: string }[];
      if (avail.length < o.quantity) throw new Error("库存不足，无法发货");
      const upd = db.prepare(`UPDATE cards SET status = 'sold', order_id = ?, sold_at = ? WHERE id = ? AND status = 'unused'`);
      for (const c of avail) {
        const r = upd.run(orderId, Date.now(), c.id);
        if (Number(r.changes) === 0) throw new Error("库存并发冲突");
      }
    } else {
      for (let i = 0; i < o.quantity; i++) createCdk("purchase", o.product_id, orderId);
    }

    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ?, pay_ref = ? WHERE id = ?`).run(
      Date.now(),
      payRef ?? null,
      orderId
    );
    return true;
  });
}

/** 订单详情（含已发货内容），用于订单查询页 */
export function orderDetail(orderId: string) {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as any;
  if (!o) return null;

  let cards: string[] = [];
  let cdks: { code: string; used: boolean }[] = [];
  if (o.status === "paid") {
    if (o.product_type === "card") {
      cards = (db.prepare(`SELECT content FROM cards WHERE order_id = ?`).all(orderId) as any[]).map(
        (r) => r.content
      );
    } else {
      cdks = (
        db.prepare(`SELECT code, status FROM cdks WHERE order_id = ? ORDER BY created_at`).all(orderId) as any[]
      ).map((r) => ({ code: r.code, used: r.status === "used" }));
    }
  }

  return {
    id: o.id,
    productName: o.product_name,
    productType: o.product_type as "card" | "file",
    quantity: o.quantity,
    amount: o.amount,
    email: o.email,
    status: o.status as "pending" | "paid",
    createdAt: o.created_at,
    cards,
    cdks,
  };
}

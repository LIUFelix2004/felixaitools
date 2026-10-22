import crypto from "node:crypto";
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
  image: string | null;
  tags: string | null;
  specs: string | null;
};

export type Spec = { name: string; price: number };

/** 解析规格 JSON，过滤非法项 */
export function parseSpecs(raw: string | null): Spec[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s: any) => ({ name: String(s?.name ?? "").trim(), price: Number(s?.price) }))
      .filter((s) => s.name && Number.isFinite(s.price) && s.price > 0);
  } catch {
    return [];
  }
}

export function parseTags(raw: string | null): string[] {
  return (raw || "")
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** 对外展示的商品结构（首页卡片 / 详情页共用） */
function toPublic(p: Product) {
  const specs = parseSpecs(p.specs);
  const minPrice = specs.length ? Math.min(...specs.map((s) => s.price)) : p.price;
  return {
    id: p.id,
    categoryId: p.category_id,
    name: p.name,
    description: p.description,
    price: p.price,
    minPrice,
    type: p.type,
    image: p.image ? `/api/img/${p.image}` : null,
    tags: parseTags(p.tags),
    specs,
  };
}

/** 查询密码只存哈希 */
export function hashQueryPassword(pw: string) {
  return crypto.createHash("sha256").update(`qp:${pw}`).digest("hex");
}

/** 公开目录：分类 + 上架商品（卡密改为人工发货，不再有库存概念） */
export function catalog() {
  const cats = db.prepare(`SELECT * FROM categories ORDER BY sort, created_at`).all() as any[];
  const prods = db
    .prepare(`SELECT * FROM products WHERE status = 'on' ORDER BY sort, created_at`)
    .all() as Product[];
  return {
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      count: prods.filter((p) => p.category_id === c.id).length,
    })),
    products: prods.map(toPublic),
  };
}

export function getProduct(id: string): Product | undefined {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as Product | undefined;
}

/** 详情页用：仅返回上架商品 */
export function publicProduct(id: string) {
  const p = getProduct(id);
  if (!p || p.status !== "on") return null;
  return toPublic(p);
}

/** 下单（含校验）：联系方式、查询密码必填 */
export function createOrder(input: {
  productId: string;
  specIndex?: number;
  quantity: number;
  contact: string;
  queryPassword: string;
  email?: string;
  provider: string;
}) {
  const p = getProduct(input.productId);
  if (!p || p.status !== "on") throw new Error("商品不存在或已下架");
  const qty = Math.max(1, Math.min(Math.floor(input.quantity || 1), 100));

  // 有规格时必须选规格，价格和名称以规格为准（服务端定价，不信任前端传价）
  const specs = parseSpecs(p.specs);
  let unitPrice = p.price;
  let displayName = p.name;
  if (specs.length) {
    const spec = specs[Number(input.specIndex)];
    if (!spec) throw new Error("请选择商品规格");
    unitPrice = spec.price;
    displayName = `${p.name}（${spec.name}）`;
  }

  const amount = Math.round(unitPrice * qty * 100) / 100;
  const id = "NO" + nanoid(14).toUpperCase();
  db.prepare(
    `INSERT INTO orders
       (id, product_id, product_name, product_type, unit_price, quantity, amount, email, contact,
        query_password, status, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    p.id,
    displayName,
    p.type,
    unitPrice,
    qty,
    amount,
    input.email ?? "",
    input.contact,
    hashQueryPassword(input.queryPassword),
    input.provider,
    Date.now()
  );
  return { orderId: id, amount, productType: p.type, productName: displayName };
}

/**
 * 支付成功（幂等）：
 * - card 商品：进入「发货中」，等管理员人工发货
 * - file 商品：生成 qty 张 CDK，绑定到订单
 */
export function fulfillOrder(orderId: string, payRef?: string): boolean {
  return tx(() => {
    const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as any;
    if (!o) return false;
    if (o.status === "paid") return true; // 幂等

    if (o.product_type === "file") {
      for (let i = 0; i < o.quantity; i++) createCdk("purchase", o.product_id, orderId);
    }

    db.prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, pay_ref = ?, ship_status = ? WHERE id = ?`
    ).run(Date.now(), payRef ?? null, o.product_type === "card" ? "waiting" : null, orderId);
    return true;
  });
}

/** 管理员人工发货：写入卡密，订单变为「已发货」 */
export function shipOrder(orderId: string, content: string) {
  const o = db.prepare(`SELECT status, product_type FROM orders WHERE id = ?`).get(orderId) as any;
  if (!o) throw new Error("订单不存在");
  if (o.status !== "paid") throw new Error("订单未支付，不能发货");
  if (o.product_type !== "card") throw new Error("只有卡密商品需要人工发货");
  db.prepare(
    `UPDATE orders SET card_content = ?, ship_status = 'shipped', shipped_at = ? WHERE id = ?`
  ).run(content, Date.now(), orderId);
}

/**
 * 订单详情。reveal=false 时不返回卡密（仅凭订单号看进度）；
 * 只有通过「联系方式 + 查询密码」校验后才 reveal。
 */
export function orderDetail(orderId: string, reveal = false) {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as any;
  if (!o) return null;

  let cards: string[] = [];
  let cdks: { code: string; used: boolean }[] = [];
  if (o.status === "paid") {
    if (o.product_type === "card") {
      if (reveal && o.ship_status === "shipped" && o.card_content) cards = [o.card_content];
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
    contact: o.contact as string,
    status: o.status as "pending" | "paid",
    shipStatus: (o.ship_status ?? null) as "waiting" | "shipped" | null,
    createdAt: o.created_at,
    cards,
    cdks,
  };
}

/** 用户凭「联系方式 + 查询密码」查订单（返回卡密） */
export function queryOrders(contact: string, password: string) {
  const rows = db
    .prepare(
      `SELECT id FROM orders WHERE contact = ? AND query_password = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(contact, hashQueryPassword(password)) as { id: string }[];
  return rows.map((r) => orderDetail(r.id, true)).filter(Boolean);
}

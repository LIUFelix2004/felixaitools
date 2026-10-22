import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");

const g = globalThis as unknown as { __db?: DatabaseSync };

export const db =
  g.__db ??
  (() => {
    const d = new DatabaseSync(DB_PATH);
    d.exec("PRAGMA journal_mode = WAL;");
    d.exec("PRAGMA foreign_keys = ON;");
    // 锁忙时最多等待 8s 再报错（构建期多个连接并发建表会短暂争锁）
    d.exec("PRAGMA busy_timeout = 8000;");
    migrate(d);
    return d;
  })();

if (process.env.NODE_ENV !== "production") g.__db = db;

/** 轻量事务助手（node:sqlite 无 .transaction()） */
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export type { StatementSync };

function migrate(d: DatabaseSync) {
  d.exec(`
    -- 商品分类
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sort        INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    -- 商品
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      category_id TEXT,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL,
      type        TEXT NOT NULL DEFAULT 'card',   -- card(秒发卡密) | file(卡密+上传文件)
      status      TEXT NOT NULL DEFAULT 'on',      -- on | off
      sort        INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    -- 卡密库存池（仅 card 类商品使用）
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      product_id  TEXT NOT NULL,
      content     TEXT NOT NULL,                   -- 发给用户的卡密 / 账号内容
      status      TEXT NOT NULL DEFAULT 'unused',  -- unused | sold
      order_id    TEXT,
      created_at  INTEGER NOT NULL,
      sold_at     INTEGER
    );

    -- 订单
    CREATE TABLE IF NOT EXISTS orders (
      id           TEXT PRIMARY KEY,
      product_id   TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      unit_price   REAL NOT NULL,
      quantity     INTEGER NOT NULL DEFAULT 1,
      amount       REAL NOT NULL,
      email        TEXT NOT NULL,
      contact      TEXT,
      status       TEXT NOT NULL DEFAULT 'pending', -- pending | paid
      provider     TEXT NOT NULL,
      pay_ref      TEXT,
      created_at   INTEGER NOT NULL,
      paid_at      INTEGER,
      query_password TEXT,                          -- 查询密码（sha256）
      ship_status  TEXT,                            -- card: waiting(发货中) | shipped(已发货)
      card_content TEXT,                            -- 人工发货的卡密内容
      shipped_at   INTEGER
    );

    -- CDK（仅 file 类商品：支付后生成，用户凭它上传文件）
    CREATE TABLE IF NOT EXISTS cdks (
      code        TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'unused',   -- unused | used | disabled
      source      TEXT NOT NULL DEFAULT 'purchase', -- purchase | manual
      product_id  TEXT,
      order_id    TEXT,
      created_at  INTEGER NOT NULL,
      used_at     INTEGER
    );

    -- 文件提交
    CREATE TABLE IF NOT EXISTS submissions (
      id          TEXT PRIMARY KEY,
      cdk_code    TEXT NOT NULL,
      email       TEXT NOT NULL,
      contact     TEXT,
      note        TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | success | failed
      admin_note  TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id            TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      stored_name   TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime          TEXT,
      size          INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_cards_prod ON cards(product_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
    CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_files_sub ON files(submission_id);
  `);

  // 旧库升级：给已存在的 orders 表补列（列已存在时 ALTER 会报错，忽略即可）
  for (const col of [
    "query_password TEXT",
    "ship_status TEXT",
    "card_content TEXT",
    "shipped_at INTEGER",
  ]) {
    try {
      d.exec(`ALTER TABLE orders ADD COLUMN ${col}`);
    } catch {}
  }
  d.exec(`CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact)`);
}

export type OrderStatus = "pending" | "paid";
export type ProductType = "card" | "file";
export type SubStatus = "pending" | "processing" | "success" | "failed";

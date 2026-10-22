// 生成演示商城数据：分类 + 商品 + 卡密库存。
// 用法: npm run seed
import { DatabaseSync } from "node:sqlite";
import { customAlphabet } from "nanoid";
import path from "node:path";
import fs from "node:fs";

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, "app.db"));
db.exec("PRAGMA foreign_keys = ON;");

// 确保表存在（与 src/lib/db.ts 一致的最小子集）
db.exec(`
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, category_id TEXT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, type TEXT NOT NULL DEFAULT 'card', status TEXT NOT NULL DEFAULT 'on', sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unused', order_id TEXT, created_at INTEGER NOT NULL, sold_at INTEGER);
`);

const id = (p) => p + customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10)();
const now = Date.now();

const cat = (name, sort) => {
  const cid = id("C");
  db.prepare(`INSERT INTO categories (id, name, sort, created_at) VALUES (?,?,?,?)`).run(cid, name, sort, now);
  return cid;
};
const prod = (categoryId, name, price, type, desc, sort) => {
  const pid = id("P");
  db.prepare(
    `INSERT INTO products (id, category_id, name, description, price, type, status, sort, created_at) VALUES (?,?,?,?,?,?,'on',?,?)`
  ).run(pid, categoryId, name, desc, price, type, sort, now);
  return pid;
};
const stock = (pid, lines) => {
  const ins = db.prepare(`INSERT INTO cards (id, product_id, content, status, created_at) VALUES (?,?,?,'unused',?)`);
  for (const l of lines) ins.run(id("K"), pid, l, now);
};

const cAi = cat("AI 成品账号", 1);
const cRecharge = cat("代充服务", 2);

const pGpt = prod(cAi, "GPT Plus 成品号", 15.0, "card", "独享成品号，自带 Plus，发货即用。", 1);
stock(pGpt, ["gptuser1@mail.com----pwd111", "gptuser2@mail.com----pwd222", "gptuser3@mail.com----pwd333", "gptuser4@mail.com----pwd444", "gptuser5@mail.com----pwd555"]);

const pClaude = prod(cAi, "Claude Pro 成品号", 20.0, "card", "Claude Pro 独享账号，秒发。", 2);
stock(pClaude, ["claude1@mail.com----pwd1", "claude2@mail.com----pwd2", "claude3@mail.com----pwd3"]);

prod(cRecharge, "GPT Plus 代充（需上传凭证）", 10.0, "file", "下单后获得 CDK，在订单页上传你的账号凭证文件，由后台代充处理。", 1);

console.log("演示数据已写入：");
console.log("- 分类 2 个（AI 成品账号 / 代充服务）");
console.log("- 商品：GPT Plus 成品号(库存5) / Claude Pro 成品号(库存3) / GPT Plus 代充(文件型)");

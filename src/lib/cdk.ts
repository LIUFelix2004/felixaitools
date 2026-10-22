import { customAlphabet } from "nanoid";
import { db, tx } from "./db";

// Human-friendly code, no ambiguous chars (no 0/O/1/I).
const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 16);

export function formatCode(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

export function createCdk(source: "purchase" | "manual", productId?: string, orderId?: string) {
  const code = formatCode(gen());
  db.prepare(
    `INSERT INTO cdks (code, status, source, product_id, order_id, created_at) VALUES (?, 'unused', ?, ?, ?, ?)`
  ).run(code, source, productId ?? null, orderId ?? null, Date.now());
  return code;
}

export function createBatch(count: number) {
  const codes: string[] = [];
  const n = Math.max(1, Math.min(count, 500));
  tx(() => {
    for (let i = 0; i < n; i++) codes.push(createCdk("manual"));
  });
  return codes;
}

export type CdkRow = {
  code: string;
  status: string;
  source: string;
  order_id: string | null;
  created_at: number;
  used_at: number | null;
};

export function getCdk(code: string): CdkRow | undefined {
  return db
    .prepare(`SELECT * FROM cdks WHERE code = ?`)
    .get(formatCode(code)) as CdkRow | undefined;
}

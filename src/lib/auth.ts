import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret() {
  return process.env.AUTH_SECRET || "dev-insecure-secret";
}

function sign(payload: string) {
  const h = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${h}`;
}

function verify(token: string): boolean {
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const expected = sign(payload);
  const ok =
    expected.length === token.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  if (!ok) return false;
  const exp = Number(payload.split("|")[1]);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSession() {
  const payload = `admin|${Date.now() + MAX_AGE * 1000}`;
  cookies().set(COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function destroySession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export function isAuthed(): boolean {
  const token = cookies().get(COOKIE)?.value;
  return !!token && verify(token);
}

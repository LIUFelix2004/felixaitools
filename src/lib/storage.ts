import fs from "node:fs";
import path from "node:path";

// 上传文件存到项目外的 /uploads（不在 public 下，不可被直接访问）
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES = 5;

// 允许的扩展名（纯业务资料，禁止可执行文件）
const ALLOWED_EXT = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
  ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".zip",
]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function isAllowed(name: string) {
  return ALLOWED_EXT.has(extOf(name));
}

export function storedPath(storedName: string) {
  // 防目录穿越
  const safe = path.basename(storedName);
  return path.join(UPLOAD_DIR, safe);
}

export async function saveBuffer(storedName: string, buf: Buffer) {
  await fs.promises.writeFile(storedPath(storedName), buf);
}

/* ---------- 商品图片（公开访问，与用户上传的资料分开存放） ---------- */

export const PRODUCT_IMG_DIR = path.join(UPLOAD_DIR, "products");
if (!fs.existsSync(PRODUCT_IMG_DIR)) fs.mkdirSync(PRODUCT_IMG_DIR, { recursive: true });

export const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB

export const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function productImagePath(name: string) {
  return path.join(PRODUCT_IMG_DIR, path.basename(name));
}

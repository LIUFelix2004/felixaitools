import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
import { IMAGE_MIME, MAX_IMAGE_SIZE, extOf, productImagePath } from "@/lib/storage";

export const runtime = "nodejs";

// 管理员上传商品图片，返回存储文件名
export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "请选择图片" }, { status: 400 });

  const ext = extOf(file.name);
  if (!IMAGE_MIME[ext])
    return NextResponse.json({ error: "只支持 jpg / png / gif / webp 图片" }, { status: 400 });
  if (file.size > MAX_IMAGE_SIZE)
    return NextResponse.json({ error: "图片不能超过 3MB" }, { status: 400 });

  const name = `${nanoid(16)}${ext}`;
  await fs.promises.writeFile(productImagePath(name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, name });
}

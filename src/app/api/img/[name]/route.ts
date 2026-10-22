import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { IMAGE_MIME, extOf, productImagePath } from "@/lib/storage";

export const runtime = "nodejs";

// 公开读取商品图片（仅限商品图目录、仅限图片类型）
export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const mime = IMAGE_MIME[extOf(params.name)];
  if (!mime) return new NextResponse("Not found", { status: 404 });
  const p = productImagePath(params.name);
  if (!fs.existsSync(p)) return new NextResponse("Not found", { status: 404 });
  const data = await fs.promises.readFile(p);
  return new NextResponse(data as any, {
    headers: {
      "Content-Type": mime,
      // 文件名是随机的，换图即换名，可以长缓存
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

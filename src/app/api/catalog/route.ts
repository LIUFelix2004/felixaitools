import { NextResponse } from "next/server";
import { catalog } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 公开商品目录（分类 + 上架商品）
export async function GET() {
  return NextResponse.json(catalog());
}

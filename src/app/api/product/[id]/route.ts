import { NextRequest, NextResponse } from "next/server";
import { publicProduct } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 商品详情（公开，仅上架商品）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const p = publicProduct(params.id);
  if (!p) return NextResponse.json({ error: "商品不存在或已下架" }, { status: 404 });
  return NextResponse.json(p);
}

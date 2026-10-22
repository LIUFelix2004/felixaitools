import { NextRequest, NextResponse } from "next/server";
import { queryOrders } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 订单查询：凭「联系方式 + 查询密码」查看订单与卡密（POST，避免密码出现在 URL）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.contact || "").trim();
  const password = String(body.password || "").trim();
  if (!contact || !password)
    return NextResponse.json({ error: "请输入联系方式和查询密码" }, { status: 400 });

  return NextResponse.json({ items: queryOrders(contact, password) });
}

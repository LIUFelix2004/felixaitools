import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/orders";
import { provider } from "@/lib/payment";

export const runtime = "nodejs";

// 仅在 mock 模式可用：模拟支付成功，生成 CDK 后跳回首页
export async function GET(req: NextRequest) {
  if (provider() !== "mock") {
    return NextResponse.json({ error: "当前非模拟支付模式" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("order");
  if (!id) return NextResponse.json({ error: "缺少 order 参数" }, { status: 400 });

  try {
    markOrderPaid(id, "MOCK");
  } catch {
    // 发货失败（如库存不足）时也跳转到订单页，页面会显示未完成状态
  }
  const url = new URL("/order", req.url);
  url.searchParams.set("order", id);
  return NextResponse.redirect(url);
}

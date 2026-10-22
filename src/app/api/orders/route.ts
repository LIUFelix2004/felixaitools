import { NextRequest, NextResponse } from "next/server";
import { createOrder, orderDetail } from "@/lib/shop";
import { markOrderPaid } from "@/lib/orders";
import { createPayment, provider, PAYTYPES, queryJhup } from "@/lib/payment";

export const runtime = "nodejs";

function clientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

// 创建订单并返回支付链接
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.contact || "").trim();
  const queryPassword = String(body.queryPassword || "").trim();
  const email = String(body.email || "").trim();
  if (contact.length < 3 || contact.length > 64)
    return NextResponse.json({ error: "请填写联系方式（QQ/微信/手机/邮箱）" }, { status: 400 });
  if (queryPassword.length < 4 || queryPassword.length > 32)
    return NextResponse.json({ error: "查询密码需 4-32 位" }, { status: 400 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });

  const paytype = PAYTYPES[String(body.paytype || "")] ? String(body.paytype) : "alipay";

  let order;
  try {
    order = createOrder({
      productId: String(body.productId || ""),
      specIndex: body.specIndex == null ? undefined : Number(body.specIndex),
      quantity: Number(body.quantity || 1),
      contact,
      queryPassword,
      email,
      provider: provider(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "下单失败" }, { status: 400 });
  }

  try {
    const pay = await createPayment({
      orderId: order.orderId,
      amount: order.amount,
      subject: order.productName,
      paytype,
      clientIp: clientIp(req),
    });
    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      productType: order.productType,
      ...pay,
    });
  } catch (e) {
    // 订单已创建为待支付；下单支付失败时提示，用户可稍后在订单查询里重试
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "发起支付失败", orderId: order.orderId },
      { status: 502 }
    );
  }
}

// 查询订单（支付成功后拿卡密 / CDK）
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("order");
  if (!id) return NextResponse.json({ error: "缺少 order 参数" }, { status: 400 });
  let d = orderDetail(id);
  if (!d) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

  // 主动对账：回调可能延迟/丢失，待支付订单在返回页时向平台查一次
  if (d.status !== "paid" && provider() === "jhup") {
    try {
      const st = await queryJhup(id);
      if (st === "TRADE_SUCCESS") {
        markOrderPaid(id);
        d = orderDetail(id) ?? d;
      }
    } catch {
      // 查询失败忽略，页面会继续轮询
    }
  }

  return NextResponse.json(d);
}

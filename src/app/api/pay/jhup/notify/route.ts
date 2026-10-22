import { NextRequest } from "next/server";
import { verifyJhupNotify } from "@/lib/payment";
import { markOrderPaid } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// jhup 聚合支付异步通知（POST, form-urlencoded）。
// 校验签名 + 商户号，trade_status=TRADE_SUCCESS 时发货，最后必须返回纯文本 "success"。
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("fail", { status: 400 });

  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  // 签名校验
  if (!verifyJhupNotify(params)) return new Response("fail", { status: 400 });
  // 商户号校验
  if (process.env.JHUP_PID && params.pid !== process.env.JHUP_PID)
    return new Response("fail", { status: 400 });

  switch (params.trade_status) {
    case "TRADE_SUCCESS":
      try {
        markOrderPaid(params.out_trade_no, params.trade_no);
      } catch {
        // 发货失败（如库存不足）：先应答避免重复通知，异常在后台订单里可见为待支付
      }
      break;
    case "TRADE_REFUND":
    case "TRADE_FREEZE":
    case "TRADE_UNFREEZE":
      // 风控/退款状态：数字商品通常已发货，这里仅记录应答；如需可在此标记订单并暂停服务。
      break;
    default:
      break;
  }

  return new Response("success");
}

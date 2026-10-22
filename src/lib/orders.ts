import { db } from "./db";
import { fulfillOrder } from "./shop";
import { notifyOrderPaid } from "./notify";

/**
 * 支付成功入口（幂等）：标记订单已支付并处理发货。
 * - card 商品：进入「发货中」，推送微信通知提醒人工发货
 * - file 商品：生成 CDK
 * 只有「本次调用才变成已支付」时才发通知，避免回调重复到达时重复推送。
 */
export function markOrderPaid(orderId: string, payRef?: string): boolean {
  const before = db.prepare(`SELECT status FROM orders WHERE id = ?`).get(orderId) as { status: string } | undefined;
  const ok = fulfillOrder(orderId, payRef);
  if (ok && before && before.status !== "paid") {
    // 异步发送，不阻塞支付回调的 "success" 应答
    notifyOrderPaid(orderId).catch((e) => console.error("[notify]", e));
  }
  return ok;
}

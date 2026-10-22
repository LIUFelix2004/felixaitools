import { fulfillOrder } from "./shop";

/**
 * 支付成功入口（幂等）：标记订单已支付并发货。
 * - card 商品：从库存池发卡密
 * - file 商品：生成 CDK
 */
export function markOrderPaid(orderId: string, payRef?: string): boolean {
  return fulfillOrder(orderId, payRef);
}

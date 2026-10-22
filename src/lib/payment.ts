import crypto from "node:crypto";

/**
 * 支付层。
 * - mock : 本地测试，点一下即支付成功。
 * - jhup : 聚合支付 pay.jhup.cn，服务端下单拿 pay_url 跳转，异步回调发货。
 * 接别的支付：实现 createPayment 和对应回调校验即可。
 */

export type CreatePaymentResult = {
  payUrl: string;
  mock: boolean;
};

export type CreatePaymentOpts = {
  orderId: string;
  amount: number;
  subject: string;
  paytype: string; // alipay | wxpay | ...
  clientIp: string;
};

export function provider() {
  return (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
}

export function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** 平台支持的支付方式（编码 → 中文名） */
export const PAYTYPES: Record<string, string> = {
  alipay: "支付宝",
  wxpay: "微信",
  qqpay: "QQ钱包",
  bank: "网银",
  jdpay: "京东钱包",
  unionpay: "云闪付",
  usdt: "USDT",
  paypal: "Paypal",
  douyinpay: "抖音支付",
};

export async function createPayment(opts: CreatePaymentOpts): Promise<CreatePaymentResult> {
  if (provider() === "jhup") return createJhup(opts);
  // mock
  return { payUrl: `/api/pay/mock?order=${encodeURIComponent(opts.orderId)}`, mock: true };
}

/* ---------------- jhup 聚合支付 ---------------- */

/**
 * MD5 签名：除 sign/sign_type 外、去空值、按键名 ASCII 升序，
 * 拼成 k=v&... 后追加 &key=密钥，MD5 后转大写。
 * 用原始值（不做 URL 编码），与文档 urldecode(http_build_query()) 一致。
 */
export function jhupSign(params: Record<string, string | number | undefined | null>, key: string) {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => {
      const v = params[k];
      return v !== "" && v !== null && v !== undefined;
    })
    .sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join("&") + "&key=" + key;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

function cfg() {
  const api = (process.env.JHUP_API_URL || "https://pay.jhup.cn").replace(/\/$/, "");
  const pid = process.env.JHUP_PID || "";
  const key = process.env.JHUP_KEY || "";
  if (!pid || !key) throw new Error("支付未配置：请在 .env.local 填写 JHUP_PID / JHUP_KEY");
  return { api, pid, key };
}

async function createJhup(opts: CreatePaymentOpts): Promise<CreatePaymentResult> {
  const { api, pid, key } = cfg();
  const params: Record<string, string> = {
    pid,
    out_trade_no: opts.orderId,
    total_amount: opts.amount.toFixed(2),
    subject: opts.subject,
    paytype_code: opts.paytype || "alipay",
    notify_url: `${siteUrl()}/api/pay/jhup/notify`,
    return_url: `${siteUrl()}/order?order=${opts.orderId}`,
    client_ip: opts.clientIp || "127.0.0.1",
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  params.sign = jhupSign(params, key);
  params.sign_type = "MD5";

  const res = await fetch(`${api}/openapi/pay/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("支付平台返回异常");
  if (Number(data.code) !== 1 || !data.data?.pay_url) {
    throw new Error(data.msg || "下单失败");
  }
  return { payUrl: data.data.pay_url as string, mock: false };
}

/** 校验 jhup 异步通知签名 */
export function verifyJhupNotify(params: Record<string, string>): boolean {
  const key = process.env.JHUP_KEY || "";
  if (!key) return false;
  const sign = params.sign;
  if (!sign) return false;
  return jhupSign(params, key) === sign.toUpperCase();
}

/** 主动查询订单状态（用于回调丢失时对账） */
export async function queryJhup(orderId: string): Promise<string | null> {
  const { api, pid, key } = cfg();
  const params: Record<string, string> = {
    pid,
    out_trade_no: orderId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  params.sign = jhupSign(params, key);
  params.sign_type = "MD5";
  const res = await fetch(`${api}/openapi/pay/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!data || Number(data.code) !== 1) return null;
  return (data.data?.trade_status as string) || null;
}

import { db } from "./db";

/**
 * 新订单推送到微信。按配置的渠道发送（可同时配多个）：
 * - PUSHPLUS_TOKEN  : pushplus.plus（关注公众号后推送到个人微信，免费 200 条/天）
 * - SERVERCHAN_KEY  : Server酱 sct.ftqq.com（推送到个人微信）
 * - WECOM_WEBHOOK   : 企业微信群机器人 webhook
 * 发送失败只记日志，绝不影响支付回调和发货。
 */

function siteUrl() {
  return (process.env.SITE_URL || "").replace(/\/$/, "");
}

function hasChannel() {
  return !!(process.env.PUSHPLUS_TOKEN || process.env.SERVERCHAN_KEY || process.env.WECOM_WEBHOOK);
}

async function postOnce(url: string, body: unknown) {
  // 服务器在香港，访问国内推送服务较慢（实测 PushPlus 约 8s），超时放宽到 25s
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) console.error("[notify]", url.split("?")[0], r.status, await r.text().catch(() => ""));
  } finally {
    clearTimeout(t);
  }
}

/** 网络异常（超时/断连）时重试一次 */
async function post(url: string, body: unknown) {
  try {
    await postOnce(url, body);
  } catch (e) {
    console.error("[notify] retry", url.split("?")[0], (e as Error)?.name);
    await postOnce(url, body);
  }
}

export async function sendWechat(title: string, lines: string[]) {
  if (!hasChannel()) return;
  const text = lines.join("\n");
  const jobs: Promise<unknown>[] = [];

  if (process.env.PUSHPLUS_TOKEN) {
    jobs.push(
      post("https://www.pushplus.plus/send", {
        token: process.env.PUSHPLUS_TOKEN,
        title,
        content: lines.join("<br/>"),
        template: "html",
      })
    );
  }
  if (process.env.SERVERCHAN_KEY) {
    jobs.push(
      post(`https://sctapi.ftqq.com/${encodeURIComponent(process.env.SERVERCHAN_KEY)}.send`, {
        title,
        desp: lines.join("\n\n"),
      })
    );
  }
  if (process.env.WECOM_WEBHOOK) {
    jobs.push(post(process.env.WECOM_WEBHOOK, { msgtype: "text", text: { content: `${title}\n${text}` } }));
  }

  await Promise.allSettled(jobs).then((rs) =>
    rs.forEach((r) => r.status === "rejected" && console.error("[notify]", r.reason))
  );
}

/** 订单支付成功通知（卡密单提醒去发货） */
export async function notifyOrderPaid(orderId: string) {
  if (!hasChannel()) return;
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as any;
  if (!o) return;
  const time = new Date(o.paid_at || Date.now()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const needShip = o.product_type === "card";
  await sendWechat(needShip ? `🛒 新订单待发货 ¥${o.amount}` : `🛒 新订单 ¥${o.amount}`, [
    `商品：${o.product_name}`,
    `数量：${o.quantity}`,
    `金额：¥${Number(o.amount).toFixed(2)}`,
    `联系方式：${o.contact || "—"}`,
    `订单号：${o.id}`,
    `时间：${time}`,
    needShip ? `👉 去后台发货：${siteUrl()}/admin` : `类型：文件处理（等待用户上传资料）`,
  ]);
}

import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { sendWechat } from "@/lib/notify";

export const runtime = "nodejs";

// 后台「测试微信通知」
export async function POST() {
  if (!isAuthed()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!process.env.PUSHPLUS_TOKEN && !process.env.SERVERCHAN_KEY && !process.env.WECOM_WEBHOOK)
    return NextResponse.json({ error: "还没配置微信通知（PUSHPLUS_TOKEN）" }, { status: 400 });
  await sendWechat("✅ 测试通知", ["订单通知配置成功！", "有新订单时会推送到这里。"]);
  return NextResponse.json({ ok: true });
}

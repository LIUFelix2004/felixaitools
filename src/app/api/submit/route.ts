import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, tx } from "@/lib/db";
import { getCdk, formatCode } from "@/lib/cdk";
import {
  MAX_FILE_SIZE,
  MAX_FILES,
  isAllowed,
  extOf,
  saveBuffer,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const code = formatCode(String(form.get("cdk") || ""));
  const email = String(form.get("email") || "").trim();
  const contact = String(form.get("contact") || "").trim();
  const note = String(form.get("note") || "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  // 基本校验
  if (!code) return NextResponse.json({ error: "缺少 CDK" }, { status: 400 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (!email && !contact)
    return NextResponse.json({ error: "缺少联系方式" }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "请至少上传一个文件" }, { status: 400 });
  if (files.length > MAX_FILES)
    return NextResponse.json({ error: `最多上传 ${MAX_FILES} 个文件` }, { status: 400 });

  for (const f of files) {
    if (f.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: `文件 ${f.name} 超过 10MB` }, { status: 400 });
    if (!isAllowed(f.name))
      return NextResponse.json({ error: `不支持的文件类型：${f.name}` }, { status: 400 });
  }

  // CDK 必须可用
  const cdk = getCdk(code);
  if (!cdk) return NextResponse.json({ error: "CDK 不存在" }, { status: 404 });
  if (cdk.status !== "unused")
    return NextResponse.json({ error: "该 CDK 不可用或已被使用" }, { status: 400 });

  // 先落盘文件，再入库（入库里原子性地占用 CDK）
  const submissionId = "S" + nanoid(14).toUpperCase();
  const saved: { id: string; stored: string; original: string; mime: string; size: number }[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const fid = nanoid(12);
    const stored = `${fid}${extOf(f.name)}`;
    await saveBuffer(stored, buf);
    saved.push({ id: fid, stored, original: f.name, mime: f.type || "", size: f.size });
  }

  try {
    const now = Date.now();
    tx(() => {
      // 再次确认并占用 CDK（防并发重复使用）
      const upd = db
        .prepare(`UPDATE cdks SET status = 'used', used_at = ? WHERE code = ? AND status = 'unused'`)
        .run(now, code);
      if (Number(upd.changes) === 0) throw new Error("CDK_TAKEN");

      db.prepare(
        `INSERT INTO submissions (id, cdk_code, email, contact, note, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(submissionId, code, email, contact || null, note || null, now, now);

      const insF = db.prepare(
        `INSERT INTO files (id, submission_id, stored_name, original_name, mime, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of saved) insF.run(s.id, submissionId, s.stored, s.original, s.mime, s.size, now);
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === "CDK_TAKEN" ? "该 CDK 刚刚已被使用" : "提交失败";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id: submissionId });
}

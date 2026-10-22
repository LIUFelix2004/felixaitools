"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "发卡商城";

type Order = {
  id: string;
  productName: string;
  productType: "card" | "file";
  quantity: number;
  amount: number;
  contact: string;
  status: "pending" | "paid";
  shipStatus: "waiting" | "shipped" | null;
  createdAt: number;
  cards: string[];
  cdks: { code: string; used: boolean }[];
};

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">加载中…</div>}>
      <OrderInner />
    </Suspense>
  );
}

function OrderInner() {
  const sp = useSearchParams();
  const orderParam = sp.get("order");
  const [current, setCurrent] = useState<Order | null>(null);

  // 支付返回：按订单号轮询进度（不含卡密）
  useEffect(() => {
    if (!orderParam) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      tries++;
      const r = await fetch(`/api/orders?order=${encodeURIComponent(orderParam)}`).then((x) => x.json());
      if (r && r.id) {
        setCurrent(r);
        // 未支付：1.5s 快速轮询；发货中：15s 慢轮询，等待人工发货
        if (r.status !== "paid" && tries < 12) timer = setTimeout(poll, 1500);
        else if (r.shipStatus === "waiting" && tries < 60) timer = setTimeout(poll, 15000);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [orderParam]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-bold text-white">智</div>
          <span className="font-semibold">{SITE}</span>
        </a>
        <a href="/" className="text-sm text-slate-500 hover:text-brand">
          ← 返回商城
        </a>
      </header>

      {current && <ProgressCard order={current} />}

      <QueryCard />
    </div>
  );
}

/* ---------- 订单进度（凭订单号，不显示卡密） ---------- */

function ProgressCard({ order }: { order: Order }) {
  return (
    <div className="card mb-5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-medium">{order.productName}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-400">{order.id}</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium text-brand">¥{order.amount.toFixed(2)}</div>
          <div className="text-xs text-slate-400">数量 {order.quantity}</div>
        </div>
      </div>

      {order.productType === "card" ? (
        <>
          <Steps order={order} />
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {order.status !== "paid"
              ? "正在确认支付，请稍候…"
              : order.shipStatus === "shipped"
              ? "已发货！请在下方输入下单时填写的联系方式和查询密码查看卡密。"
              : "支付成功，客服正在为你人工发货，请耐心等待（本页会自动刷新进度）。发货后在下方输入联系方式 + 查询密码查看卡密。"}
          </p>
        </>
      ) : (
        <FileSection order={order} />
      )}
    </div>
  );
}

function Steps({ order }: { order: Order }) {
  const paid = order.status === "paid";
  const shipped = order.shipStatus === "shipped";
  const steps = [
    { label: "已支付", done: paid },
    { label: "发货中", done: paid, active: paid && !shipped },
    { label: "已发货", done: shipped },
  ];
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                s.done && !s.active
                  ? "bg-emerald-500 text-white"
                  : s.active
                  ? "animate-pulse bg-amber-400 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              {s.done && !s.active ? "✓" : i + 1}
            </div>
            <span className={`mt-1.5 text-xs ${s.done || s.active ? "text-slate-700" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 mb-5 h-1 flex-1 rounded ${steps[i + 1].done ? "bg-emerald-500" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- 查询（联系方式 + 查询密码 → 卡密） ---------- */

function QueryCard() {
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const query = useCallback(async () => {
    setErr("");
    if (!contact.trim() || !password.trim()) {
      setErr("请输入联系方式和查询密码");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/order/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), password: password.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "查询失败");
        return;
      }
      setItems(d.items || []);
    } finally {
      setBusy(false);
    }
  }, [contact, password]);

  return (
    <div className="card p-5">
      <h1 className="text-lg font-semibold">订单查询 / 查看卡密</h1>
      <p className="mb-3 mt-1 text-sm text-slate-500">输入下单时填写的联系方式和查询密码。</p>
      <div className="space-y-2">
        <input
          className="input"
          placeholder="联系方式（QQ / 微信 / 手机 / 邮箱）"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder="查询密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query()}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full" onClick={query} disabled={busy}>
          {busy ? "查询中…" : "查询"}
        </button>
      </div>

      {items && items.length === 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">
          没有找到订单，请检查联系方式和查询密码是否正确
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items?.map((o) => (
          <div key={o.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{o.productName}</div>
                <div className="font-mono text-xs text-slate-400">{o.id}</div>
              </div>
              <StatusBadge order={o} />
            </div>
            {o.productType === "card" && o.status === "paid" && (
              o.shipStatus === "shipped" && o.cards.length > 0 ? (
                <div>
                  <div className="mb-1 text-sm text-slate-600">你的卡密 / 账号（请妥善保存）：</div>
                  {o.cards.map((c, i) => (
                    <textarea
                      key={i}
                      readOnly
                      className="input select-all font-mono text-sm"
                      rows={Math.min(6, Math.max(2, c.split("\n").length))}
                      value={c}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">发货中，请稍后再来查询</div>
              )
            )}
            {o.productType === "file" && o.status === "paid" && <FileSection order={o} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ order }: { order: Order }) {
  if (order.status !== "paid") return <span className="badge bg-slate-100 text-slate-500">待支付</span>;
  if (order.productType === "card") {
    return order.shipStatus === "shipped" ? (
      <span className="badge bg-emerald-100 text-emerald-700">已发货</span>
    ) : (
      <span className="badge bg-amber-100 text-amber-700">发货中</span>
    );
  }
  return <span className="badge bg-emerald-100 text-emerald-700">已支付</span>;
}

/* ---------- 文件处理型：CDK + 上传 ---------- */

function FileSection({ order }: { order: Order }) {
  if (order.status !== "paid")
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">正在确认支付，请稍候…</div>;
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-700">请用下方每个 CDK 上传对应的资料文件，提交后由后台处理：</div>
      <div className="space-y-3">
        {order.cdks.map((c) => (
          <CdkUpload key={c.code} code={c.code} used={c.used} contact={order.contact} />
        ))}
      </div>
    </div>
  );
}

function CdkUpload({ code, used, contact }: { code: string; used: boolean; contact: string }) {
  const [done, setDone] = useState(used);
  const [files, setFiles] = useState<FileList | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!files || files.length === 0) {
      setErr("请选择要上传的文件");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("cdk", code);
      fd.set("contact", contact);
      fd.set("note", note);
      Array.from(files).forEach((f) => fd.append("files", f));
      const r = await fetch("/api/submit", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "提交失败");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500">{code}</span>
        {done && <span className="badge bg-emerald-100 text-emerald-700">已提交</span>}
      </div>
      {!done && (
        <div className="space-y-2">
          <input
            type="file"
            multiple
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white"
            onChange={(e) => setFiles(e.target.files)}
          />
          <input className="input !py-2 text-sm" placeholder="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <button className="btn-primary !py-2 text-sm" onClick={submit} disabled={busy}>
            {busy ? "提交中…" : "提交文件"}
          </button>
        </div>
      )}
    </div>
  );
}

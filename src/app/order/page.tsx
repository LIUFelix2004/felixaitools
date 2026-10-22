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
  email: string;
  status: "pending" | "paid";
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
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 支付返回：轮询订单直到已支付
  useEffect(() => {
    if (!orderParam) return;
    let tries = 0;
    const poll = async () => {
      tries++;
      const r = await fetch(`/api/orders?order=${encodeURIComponent(orderParam)}`).then((x) => x.json());
      if (r && r.id) {
        setOrders([r]);
        if (r.status !== "paid" && tries < 12) setTimeout(poll, 1500);
      }
    };
    poll();
  }, [orderParam]);

  const query = useCallback(async () => {
    if (!q) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/order/query?q=${encodeURIComponent(q)}`).then((x) => x.json());
      setOrders(r.items || []);
    } finally {
      setBusy(false);
    }
  }, [q]);

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

      <div className="card mb-5 p-5">
        <h1 className="text-lg font-semibold">订单查询</h1>
        <p className="mb-3 mt-1 text-sm text-slate-500">输入订单号（NO 开头）或下单邮箱。</p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="订单号 或 邮箱"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query()}
          />
          <button className="btn-primary" onClick={query} disabled={busy || !q}>
            查询
          </button>
        </div>
      </div>

      {orders && orders.length === 0 && (
        <div className="card p-8 text-center text-slate-400">没有找到相关订单</div>
      )}

      <div className="space-y-4">
        {orders?.map((o) => (
          <OrderBlock key={o.id} order={o} />
        ))}
      </div>
    </div>
  );
}

function OrderBlock({ order }: { order: Order }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium">{order.productName}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-400">{order.id}</div>
        </div>
        <span
          className={`badge ${order.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
        >
          {order.status === "paid" ? "已支付" : "待支付 / 发货中"}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
        <Info k="数量" v={String(order.quantity)} />
        <Info k="金额" v={`¥${order.amount.toFixed(2)}`} />
        <Info k="邮箱" v={order.email} />
      </div>

      {order.status !== "paid" && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          正在确认支付并发货，请稍候…（本页每 1.5 秒自动刷新）
        </div>
      )}

      {order.status === "paid" && order.productType === "card" && (
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">你的卡密 / 账号（请妥善保存）：</div>
          <div className="space-y-2">
            {order.cards.map((c, i) => (
              <textarea
                key={i}
                readOnly
                className="input select-all font-mono text-sm"
                rows={Math.min(4, c.split("\n").length)}
                value={c}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            ))}
          </div>
        </div>
      )}

      {order.status === "paid" && order.productType === "file" && (
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">
            请用下方每个 CDK 上传对应的资料文件，提交后由后台处理：
          </div>
          <div className="space-y-3">
            {order.cdks.map((c) => (
              <CdkUpload key={c.code} code={c.code} used={c.used} email={order.email} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-400">{k}</div>
      <div className="mt-0.5 truncate">{v}</div>
    </div>
  );
}

function CdkUpload({ code, used, email }: { code: string; used: boolean; email: string }) {
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
      fd.set("email", email);
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

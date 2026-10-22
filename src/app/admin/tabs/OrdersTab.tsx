"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer, fmt } from "./ui";

type Order = {
  id: string;
  productName: string;
  productType: "card" | "file";
  quantity: number;
  amount: number;
  contact: string | null;
  email: string | null;
  status: "pending" | "paid";
  shipStatus: "waiting" | "shipped" | null;
  cardContent: string | null;
  createdAt: number;
  paidAt: number | null;
  shippedAt: number | null;
};

export default function OrdersTab({ guard }: { guard: (s: number) => void }) {
  const [items, setItems] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [revenue, setRevenue] = useState(0);
  const [filter, setFilter] = useState("waiting");
  const [q, setQ] = useState("");
  const [shipping, setShipping] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/orders?status=${filter}&q=${encodeURIComponent(q)}`);
    guard(r.status);
    if (!r.ok) return;
    const d = await r.json();
    setItems(d.items || []);
    setCounts(d.counts || {});
    setRevenue(d.revenue || 0);
  }, [filter, q, guard]);

  useEffect(() => {
    load();
  }, [load]);

  // 后台挂着时每 30 秒自动刷新，新订单能及时看到
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const tabs = [
    { k: "waiting", label: "待发货" },
    { k: "all", label: "全部" },
    { k: "paid", label: "已支付" },
    { k: "pending", label: "待支付" },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="待发货" value={counts.waiting || 0} highlight={(counts.waiting || 0) > 0} />
        <Stat label="总订单" value={counts.all || 0} />
        <Stat label="已支付" value={counts.paid || 0} />
        <Stat label="营收 (¥)" value={revenue.toFixed(2)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`badge border px-3 py-1.5 ${
              filter === t.k ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t.label} {counts[t.k] != null ? `(${counts[t.k]})` : ""}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <input
            className="input !py-1.5 w-56"
            placeholder="搜索订单号 / 联系方式 / 商品"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn-ghost !py-1.5" onClick={load}>
            刷新
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">订单号</th>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">金额</th>
              <th className="px-4 py-3">联系方式</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  {filter === "waiting" ? "没有待发货的订单" : "暂无订单"}
                </td>
              </tr>
            )}
            {items.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                <td className="px-4 py-3">
                  {o.productName}
                  <span
                    className={`badge ml-2 ${
                      o.productType === "card" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {o.productType === "card" ? "卡密" : "文件"}
                  </span>
                </td>
                <td className="px-4 py-3">{o.quantity}</td>
                <td className="px-4 py-3">¥{o.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <div>{o.contact || "—"}</div>
                  {o.email && <div className="text-xs text-slate-400">{o.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <OrderBadge o={o} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmt(o.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {o.productType === "card" && o.status === "paid" && (
                    <button className="text-brand hover:underline" onClick={() => setShipping(o)}>
                      {o.shipStatus === "shipped" ? "查看/改卡密" : "发货"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shipping && (
        <ShipDrawer
          order={shipping}
          onClose={() => setShipping(null)}
          onDone={() => {
            setShipping(null);
            load();
          }}
        />
      )}
    </>
  );
}

function OrderBadge({ o }: { o: Order }) {
  if (o.status !== "paid") return <span className="badge bg-slate-100 text-slate-500">待支付</span>;
  if (o.productType === "card") {
    return o.shipStatus === "shipped" ? (
      <span className="badge bg-emerald-100 text-emerald-700">已发货</span>
    ) : (
      <span className="badge bg-amber-100 text-amber-700">待发货</span>
    );
  }
  return <span className="badge bg-emerald-100 text-emerald-700">已支付</span>;
}

function ShipDrawer({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [content, setContent] = useState(order.cardContent || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ship = async () => {
    setErr("");
    if (!content.trim()) {
      setErr("请填写卡密内容");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, content }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "发货失败");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={order.shipStatus === "shipped" ? "修改卡密" : "人工发货"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Row k="订单号" v={<span className="font-mono">{order.id}</span>} />
        <Row k="商品" v={`${order.productName} × ${order.quantity}`} />
        <Row k="金额" v={`¥${order.amount.toFixed(2)}`} />
        <Row k="联系方式" v={order.contact || "—"} />
        {order.email && <Row k="邮箱" v={order.email} />}
        <Row k="支付时间" v={fmt(order.paidAt)} />

        <div>
          <div className="mb-1 text-slate-600">
            卡密内容{order.quantity > 1 ? `（共 ${order.quantity} 份，可每行一条）` : ""}
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-sm"
            placeholder={"例如：\n账号：xxx@mail.com\n密码：xxxxxx"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">保存后用户端立即显示「已发货」，用户凭联系方式 + 查询密码查看。</p>
        </div>
        {err && <div className="text-red-600">{err}</div>}
        <button className="btn-primary w-full" onClick={ship} disabled={busy}>
          {busy ? "提交中…" : order.shipStatus === "shipped" ? "保存修改" : "确认发货"}
        </button>
      </div>
    </Drawer>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-16 shrink-0 text-slate-400">{k}</div>
      <div className="flex-1 break-all">{v}</div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className={`text-xs ${highlight ? "text-amber-700" : "text-slate-400"}`}>{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${highlight ? "text-amber-700" : ""}`}>{value}</div>
    </div>
  );
}

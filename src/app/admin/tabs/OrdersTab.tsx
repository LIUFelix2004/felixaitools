"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt } from "./ui";

type Order = {
  id: string;
  productName: string;
  productType: "card" | "file";
  quantity: number;
  amount: number;
  email: string;
  contact: string | null;
  status: "pending" | "paid";
  createdAt: number;
  paidAt: number | null;
};

export default function OrdersTab({ guard }: { guard: (s: number) => void }) {
  const [items, setItems] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [revenue, setRevenue] = useState(0);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

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

  const tabs = [
    { k: "all", label: "全部" },
    { k: "paid", label: "已支付" },
    { k: "pending", label: "待支付" },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
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
            placeholder="搜索订单号 / 邮箱 / 商品"
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
              <th className="px-4 py-3">邮箱</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">时间</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  暂无订单
                </td>
              </tr>
            )}
            {items.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                <td className="px-4 py-3">
                  {o.productName}
                  <span className={`badge ml-2 ${o.productType === "card" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}>
                    {o.productType === "card" ? "秒发" : "文件"}
                  </span>
                </td>
                <td className="px-4 py-3">{o.quantity}</td>
                <td className="px-4 py-3">¥{o.amount.toFixed(2)}</td>
                <td className="px-4 py-3">{o.email}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${o.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {o.status === "paid" ? "已支付" : "待支付"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmt(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

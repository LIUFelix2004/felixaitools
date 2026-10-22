"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrdersTab from "./tabs/OrdersTab";
import ProductsTab from "./tabs/ProductsTab";
import SubmissionsTab from "./tabs/SubmissionsTab";

type Tab = "orders" | "products" | "subs";

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("orders");

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const guard = useCallback(
    (status: number) => {
      if (status === 401) router.push("/admin/login");
    },
    [router]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "orders", label: "订单管理" },
    { key: "products", label: "商品管理" },
    { key: "subs", label: "文件提交" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">管理后台</h1>
          <p className="text-sm text-slate-400">订单 · 商品 / 卡密库存 · 文件提交处理</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="btn-ghost" target="_blank">
            查看商城
          </a>
          <button className="btn-ghost" onClick={logout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="mb-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersTab guard={guard} />}
      {tab === "products" && <ProductsTab guard={guard} />}
      {tab === "subs" && <SubmissionsTab guard={guard} />}
    </div>
  );
}

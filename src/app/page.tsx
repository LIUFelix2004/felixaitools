"use client";

import { useEffect, useMemo, useState } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "发卡商城";
const NOTICE = (process.env.NEXT_PUBLIC_SHOP_NOTICE || "").replace(/\\n/g, "\n");

type Category = { id: string; name: string };
type Product = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  type: "card" | "file";
  stock: number | null;
};

export default function Shop() {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [active, setActive] = useState<string>("all");
  const [buying, setBuying] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        setCats(d.categories || []);
        setProds(d.products || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(
    () => (active === "all" ? prods : prods.filter((p) => p.categoryId === active)),
    [prods, active]
  );

  const tabs = [{ id: "all", name: "全部" }, ...cats];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-bold text-white">
            智
          </div>
          <div className="font-semibold">{SITE}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a href="/order" className="text-slate-600 hover:text-brand">
            订单查询
          </a>
          <a href="/admin" className="text-slate-400 hover:text-slate-600">
            管理员
          </a>
        </div>
      </header>

      {NOTICE && (
        <div className="mb-5 whitespace-pre-line rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          📢 {NOTICE}
        </div>
      )}

      <div className="flex flex-col gap-5 md:flex-row">
        {/* 分类 */}
        <aside className="md:w-44 md:shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-left text-sm transition md:w-full ${
                  active === t.id
                    ? "bg-brand text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </aside>

        {/* 商品 */}
        <main className="flex-1">
          {loading ? (
            <div className="py-20 text-center text-slate-400">加载中…</div>
          ) : shown.length === 0 ? (
            <div className="card py-20 text-center text-slate-400">暂无商品</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {shown.map((p) => (
                <ProductCard key={p.id} p={p} onBuy={() => setBuying(p)} />
              ))}
            </div>
          )}
        </main>
      </div>

      {buying && <BuyModal product={buying} onClose={() => setBuying(null)} />}

      <footer className="mt-10 text-center text-xs text-slate-400">
        {SITE} · 自动发卡 · 付款即时到账
      </footer>
    </div>
  );
}

function ProductCard({ p, onBuy }: { p: Product; onBuy: () => void }) {
  const soldOut = p.type === "card" && (p.stock ?? 0) <= 0;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{p.name}</h3>
        <span
          className={`badge shrink-0 ${
            p.type === "card" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
          }`}
        >
          {p.type === "card" ? "秒发" : "需上传文件"}
        </span>
      </div>
      {p.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</p>}
      <div className="mt-3 flex items-end justify-between">
        <div className="text-brand">
          <span className="text-lg font-bold">¥{p.price.toFixed(2)}</span>
          {p.type === "card" && (
            <span className="ml-2 text-xs text-slate-400">库存 {p.stock}</span>
          )}
        </div>
        <button className="btn-primary !px-4 !py-2 text-sm" onClick={onBuy} disabled={soldOut}>
          {soldOut ? "已售罄" : "购买"}
        </button>
      </div>
    </div>
  );
}

function BuyModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [qty, setQty] = useState(1);
  const [paytype, setPaytype] = useState("alipay");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const PAY_OPTIONS = [
    { code: "alipay", label: "支付宝" },
    { code: "wxpay", label: "微信" },
  ];

  const max = product.type === "card" ? Math.max(1, product.stock ?? 1) : 99;
  const total = (product.price * qty).toFixed(2);

  const buy = async () => {
    setErr("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr("请填写正确的邮箱（用于找回订单）");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: qty, email, contact, paytype }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "下单失败");
        return;
      }
      if (d.payUrl) window.location.href = d.payUrl;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{product.name}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">单价</span>
            <span className="font-medium text-brand">¥{product.price.toFixed(2)}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">购买数量</label>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <input
                type="number"
                min={1}
                max={max}
                className="input w-20 text-center"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
              />
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty((q) => Math.min(max, q + 1))}>
                ＋
              </button>
              {product.type === "card" && <span className="text-xs text-slate-400">库存 {product.stock}</span>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">邮箱 *（用于找回订单）</label>
            <input className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">联系方式（选填）</label>
            <input className="input" placeholder="QQ / 微信" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">支付方式</label>
            <div className="flex gap-2">
              {PAY_OPTIONS.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setPaytype(o.code)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                    paytype === o.code
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {product.type === "file" && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-600">
              此商品为「需上传文件」类型：付款后会得到 CDK，在订单页上传资料文件，由后台处理。
            </p>
          )}
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        </div>

        <button className="btn-primary mt-4 w-full" onClick={buy} disabled={busy || !email}>
          {busy ? "提交中…" : `去支付 ¥${total}`}
        </button>
      </div>
    </div>
  );
}

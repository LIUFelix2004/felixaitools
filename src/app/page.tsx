"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductImage, SITE, SiteHeader, SupportButton, TagList } from "@/components/SiteChrome";

const NOTICE = (process.env.NEXT_PUBLIC_SHOP_NOTICE || "").replace(/\\n/g, "\n");

type Category = { id: string; name: string; count: number };
type Product = {
  id: string;
  categoryId: string | null;
  name: string;
  minPrice: number;
  type: "card" | "file";
  image: string | null;
  tags: string[];
  specs: { name: string; price: number }[];
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Shop />
    </Suspense>
  );
}

function Shop() {
  const sp = useSearchParams();
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [active, setActive] = useState<string>("all");
  const [kw, setKw] = useState(sp.get("q") || "");
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

  const shown = useMemo(() => {
    const k = kw.toLowerCase();
    return prods.filter(
      (p) =>
        (active === "all" || p.categoryId === active) &&
        (!k || p.name.toLowerCase().includes(k) || p.tags.some((t) => t.toLowerCase().includes(k)))
    );
  }, [prods, active, kw]);

  const tabs = [{ id: "all", name: "全部", count: prods.length }, ...cats.filter((c) => c.count > 0)];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-3">
      <SiteHeader active="shop" search={kw} onSearch={setKw} />

      {NOTICE && (
        <section className="card mb-5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">📢</span>
            公告
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{NOTICE}</p>
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">🛒</span>
          购买
          {kw && <span className="font-normal text-slate-400">· 搜索「{kw}」</span>}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
                active === t.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.name}
              <span className={`text-xs ${active === t.id ? "text-white/70" : "text-slate-400"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">加载中…</div>
        ) : shown.length === 0 ? (
          <div className="py-20 text-center text-slate-400">{kw ? "没有找到相关商品" : "暂无商品"}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-xs text-slate-400">
        {SITE} · 付款后人工发货 · 凭联系方式 + 查询密码查看卡密
      </footer>
      <SupportButton />
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/item/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-slate-50">
        <ProductImage src={p.image} name={p.name} className="transition group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <TagList tags={p.tags} type={p.type} max={2} />
        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-slate-800">{p.name}</h3>
        <div className="mt-auto pt-2 text-brand">
          <span className="text-xs">¥</span>
          <span className="text-lg font-bold">{p.minPrice.toFixed(2)}</span>
          {p.specs.length > 1 && <span className="ml-0.5 text-xs text-slate-400">起</span>}
        </div>
      </div>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "发卡商城";
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || "";
const SUPPORT_TEXT = process.env.NEXT_PUBLIC_SUPPORT_TEXT || "在线客服";

/** 顶部导航：Logo / 购物 / 订单查询 / 搜索 */
export function SiteHeader({
  active,
  search,
  onSearch,
}: {
  active?: "shop" | "order";
  search?: string;
  onSearch?: (q: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(search ?? "");
  useEffect(() => setQ(search ?? ""), [search]);

  const submit = () => {
    if (onSearch) onSearch(q.trim());
    else router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  };

  const navCls = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition ${
      on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-3 z-40 mb-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur sm:flex-nowrap">
        <Link href="/" className="mr-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">智</div>
          <span className="whitespace-nowrap font-semibold">{SITE}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/" className={navCls(active === "shop")}>
            🛒 <span>购物</span>
          </Link>
          <Link href="/order" className={navCls(active === "order")}>
            📄 <span>订单查询</span>
          </Link>
        </nav>
        <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-72">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              className="input !rounded-xl !py-2 pl-9"
              placeholder="搜索商品关键词"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                onSearch?.(e.target.value.trim());
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

/** 右下角在线客服（配置 NEXT_PUBLIC_SUPPORT_URL 后显示） */
export function SupportButton() {
  if (!SUPPORT_URL) return null;
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
    >
      🎧 {SUPPORT_TEXT}
    </a>
  );
}

/** 商品图（无图时用首字占位） */
export function ProductImage({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={`h-full w-full object-cover ${className}`} loading="lazy" />
  ) : (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-slate-100 text-3xl font-bold text-indigo-400 ${className}`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

export function TagList({ tags, type, max }: { tags: string[]; type?: "card" | "file"; max?: number }) {
  const list = max ? tags.slice(0, max) : tags;
  return (
    <div className="flex flex-wrap gap-1">
      {type && (
        <span
          className={`badge text-[11px] ${
            type === "card" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
          }`}
        >
          {type === "card" ? "人工发货" : "需上传文件"}
        </span>
      )}
      {list.map((t, i) => (
        <span
          key={t}
          className={`badge text-[11px] ${i % 2 ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

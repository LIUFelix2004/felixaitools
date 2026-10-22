"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "./ui";

type Category = { id: string; name: string; sort: number; product_count: number };
type Product = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string | null;
  price: number;
  type: "card" | "file";
  status: "on" | "off";
  sort: number;
  soldCount: number;
};

export default function ProductsTab({ guard }: { guard: (s: number) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const load = useCallback(async () => {
    const [rc, rp] = await Promise.all([fetch("/api/admin/categories"), fetch("/api/admin/products")]);
    guard(rc.status);
    if (rc.ok) setCats((await rc.json()).items || []);
    if (rp.ok) setProds((await rp.json()).items || []);
  }, [guard]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <CategorySection cats={cats} onChange={load} />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">商品</h2>
        <button className="btn-primary !py-2" onClick={() => setEditing({ type: "card", status: "on", price: 0 })}>
          + 新增商品
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3">分类</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">价格</th>
              <th className="px-4 py-3">已售</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {prods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  还没有商品，点右上角新增
                </td>
              </tr>
            )}
            {prods.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.categoryName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.type === "card" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}>
                    {p.type === "card" ? "卡密·人工发货" : "文件处理"}
                  </span>
                </td>
                <td className="px-4 py-3">¥{p.price.toFixed(2)}</td>
                <td className="px-4 py-3">{p.soldCount}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.status === "on" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.status === "on" ? "上架" : "下架"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-brand hover:underline" onClick={() => setEditing(p)}>
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditor cats={cats} product={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}

function CategorySection({ cats, onChange }: { cats: Category[]; onChange: () => void }) {
  const [name, setName] = useState("");

  const add = async () => {
    if (!name) return;
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    onChange();
  };
  const del = async (id: string) => {
    const r = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    if (!r.ok) alert((await r.json()).error);
    onChange();
  };

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-base font-semibold">商品分类</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-2 text-sm">
            {c.name}
            <span className="text-xs text-slate-400">{c.product_count}</span>
            <button className="text-slate-400 hover:text-red-500" onClick={() => del(c.id)}>
              ✕
            </button>
          </span>
        ))}
        {cats.length === 0 && <span className="text-sm text-slate-400">还没有分类</span>}
      </div>
      <div className="flex gap-2">
        <input className="input !py-1.5 max-w-xs" placeholder="新分类名，如 GPT账号" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-ghost !py-1.5" onClick={add}>
          添加分类
        </button>
      </div>
    </div>
  );
}

function ProductEditor({
  cats,
  product,
  onClose,
  onSaved,
}: {
  cats: Category[];
  product: Partial<Product>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !product.id;
  const [f, setF] = useState<Partial<Product>>({
    categoryId: product.categoryId ?? null,
    name: product.name ?? "",
    description: product.description ?? "",
    price: product.price ?? 0,
    type: product.type ?? "card",
    status: product.status ?? "on",
    sort: product.sort ?? 0,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name || f.price == null) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/products", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? f : { id: product.id, ...f }),
      });
      if (r.ok) {
        onSaved();
        onClose();
      } else {
        alert((await r.json()).error);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("确定删除/下架该商品？")) return;
    await fetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  };

  return (
    <Drawer title={isNew ? "新增商品" : "编辑商品"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Field label="商品名 *">
          <input className="input" value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="分类">
          <select className="input" value={f.categoryId || ""} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })}>
            <option value="">未分类</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="类型">
          <select
            className="input"
            value={f.type}
            onChange={(e) => setF({ ...f, type: e.target.value as "card" | "file" })}
            disabled={!isNew}
          >
            <option value="card">卡密（付款后人工发货）</option>
            <option value="file">文件处理（发 CDK，用户上传文件）</option>
          </select>
          {!isNew && <p className="mt-1 text-xs text-slate-400">类型创建后不可更改</p>}
        </Field>
        <Field label="价格 (¥)">
          <input type="number" step="0.01" className="input" value={f.price ?? 0} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
        </Field>
        <Field label="描述">
          <textarea className="input min-h-[72px]" value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="排序（小的在前）">
          <input type="number" className="input" value={f.sort ?? 0} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
        </Field>
        <Field label="状态">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "on" | "off" })}>
            <option value="on">上架</option>
            <option value="off">下架</option>
          </select>
        </Field>

        <div className="flex gap-2 pt-2">
          <button className="btn-primary flex-1" onClick={save} disabled={busy || !f.name}>
            {busy ? "保存中…" : "保存"}
          </button>
          {!isNew && (
            <button className="btn-ghost text-red-600" onClick={remove}>
              删除
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-slate-600">{label}</label>
      {children}
    </div>
  );
}

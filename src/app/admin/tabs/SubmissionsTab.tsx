"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer, SubStatusBadge, SUB_LABEL, fmt } from "./ui";

type Sub = {
  id: string;
  cdk: string;
  email: string;
  contact: string | null;
  note: string | null;
  status: string;
  adminNote: string | null;
  fileCount: number;
  createdAt: number;
  updatedAt: number;
};

const STATUS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待处理" },
  { key: "processing", label: "处理中" },
  { key: "success", label: "已完成" },
  { key: "failed", label: "已失败" },
];

export default function SubmissionsTab({ guard }: { guard: (s: number) => void }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Sub[]>([]);
  const [active, setActive] = useState<Sub | null>(null);
  const [files, setFiles] = useState<any[]>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/submissions?status=${filter}&q=${encodeURIComponent(q)}`);
    guard(r.status);
    if (!r.ok) return;
    const d = await r.json();
    setCounts(d.counts || {});
    setItems(d.items || []);
  }, [filter, q, guard]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (s: Sub) => {
    setActive(s);
    const d = await fetch(`/api/admin/submissions/${s.id}`).then((x) => x.json());
    setFiles(d.files || []);
  };

  const update = async (id: string, patch: any) => {
    await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
    if (active?.id === id) setActive((a) => (a ? { ...a, ...patch } : a));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`badge border px-3 py-1.5 ${
              filter === s.key ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {s.label} {counts[s.key] != null ? `(${counts[s.key]})` : ""}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <input
            className="input !py-1.5 w-56"
            placeholder="搜索邮箱 / CDK / 联系方式"
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
              <th className="px-4 py-3">邮箱 / 联系</th>
              <th className="px-4 py-3">CDK</th>
              <th className="px-4 py-3">文件</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">提交时间</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  暂无数据
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.email}</div>
                  {s.contact && <div className="text-xs text-slate-400">{s.contact}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.cdk}</td>
                <td className="px-4 py-3">{s.fileCount}</td>
                <td className="px-4 py-3">
                  <SubStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmt(s.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-brand hover:underline" onClick={() => openDetail(s)}>
                    处理
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <Drawer title="提交详情" onClose={() => setActive(null)}>
          <div className="space-y-4 text-sm">
            <Row k="邮箱" v={active.email} />
            <Row k="联系方式" v={active.contact || "—"} />
            <Row k="CDK" v={<span className="font-mono">{active.cdk}</span>} />
            <Row k="备注" v={active.note || "—"} />
            <Row k="提交时间" v={fmt(active.createdAt)} />

            <div>
              <div className="mb-1 text-slate-500">资料文件</div>
              <div className="space-y-1.5">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/admin/files/${f.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <span className="truncate">{f.original_name}</span>
                    <span className="ml-3 shrink-0 text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB ↓</span>
                  </a>
                ))}
                {files.length === 0 && <div className="text-xs text-slate-400">无文件</div>}
              </div>
            </div>

            <div>
              <div className="mb-1 text-slate-500">更新状态</div>
              <div className="flex flex-wrap gap-2">
                {(["pending", "processing", "success", "failed"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => update(active.id, { status: st })}
                    className={`badge border px-3 py-1.5 ${
                      active.status === st ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {SUB_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-slate-500">管理员备注（用户可见）</div>
              <AdminNote value={active.adminNote || ""} onSave={(v) => update(active.id, { adminNote: v })} />
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-20 shrink-0 text-slate-400">{k}</div>
      <div className="flex-1 break-all">{v}</div>
    </div>
  );
}

function AdminNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex gap-2">
      <input className="input !py-1.5" value={v} onChange={(e) => setV(e.target.value)} placeholder="例如：已完成，请查收" />
      <button className="btn-ghost !py-1.5" onClick={() => onSave(v)}>
        保存
      </button>
    </div>
  );
}

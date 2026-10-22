"use client";

export function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString("zh-CN", { hour12: false }) : "—";
}

export const SUB_LABEL: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  success: "已完成",
  failed: "已失败",
};

export function SubStatusBadge({ status }: { status: string }) {
  const c =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "failed"
      ? "bg-red-100 text-red-600"
      : status === "processing"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";
  return <span className={`badge ${c}`}>{SUB_LABEL[status] ?? status}</span>;
}

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

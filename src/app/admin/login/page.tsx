"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const login = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const d = await r.json();
        setErr(d.error || "登录失败");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="card p-6">
        <h1 className="text-lg font-semibold">管理员登录</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">请输入后台密码。</p>
        <input
          type="password"
          className="input"
          placeholder="管理员密码"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          autoFocus
        />
        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        <button className="btn-primary mt-4 w-full" onClick={login} disabled={busy || !pw}>
          {busy ? "登录中…" : "登录"}
        </button>
      </div>
    </div>
  );
}

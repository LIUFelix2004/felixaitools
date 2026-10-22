"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage, SiteHeader, SupportButton, TagList } from "@/components/SiteChrome";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minPrice: number;
  type: "card" | "file";
  image: string | null;
  tags: string[];
  specs: { name: string; price: number }[];
};

const PAY_OPTIONS = [
  { code: "alipay", label: "支付宝" },
  { code: "wxpay", label: "微信" },
];

export default function ItemPage({ params }: { params: { id: string } }) {
  const [p, setP] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/product/${encodeURIComponent(params.id)}`).then(async (r) => {
      if (!r.ok) return setNotFound(true);
      setP(await r.json());
    });
  }, [params.id]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-3">
      <SiteHeader active="shop" />
      {notFound ? (
        <div className="card py-20 text-center text-slate-400">
          商品不存在或已下架 ·{" "}
          <Link href="/" className="text-brand hover:underline">
            返回商城
          </Link>
        </div>
      ) : !p ? (
        <div className="py-20 text-center text-slate-400">加载中…</div>
      ) : (
        <Detail p={p} />
      )}
      <SupportButton />
    </div>
  );
}

function Detail({ p }: { p: Product }) {
  const hasSpecs = p.specs.length > 0;
  const [spec, setSpec] = useState(0);
  const [contact, setContact] = useState("");
  const [queryPassword, setQueryPassword] = useState("");
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState(1);
  const [paytype, setPaytype] = useState("alipay");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const unit = hasSpecs ? p.specs[spec].price : p.price;
  const total = (unit * qty).toFixed(2);

  const buy = async () => {
    setErr("");
    if (contact.trim().length < 3) return setErr("请填写联系方式（QQ / 微信 / 手机 / 邮箱）");
    if (queryPassword.trim().length < 4) return setErr("请设置查询密码（至少 4 位），查看卡密时要用");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("邮箱格式不正确");
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: p.id,
          specIndex: hasSpecs ? spec : undefined,
          quantity: qty,
          contact: contact.trim(),
          queryPassword: queryPassword.trim(),
          email: email.trim(),
          paytype,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || "下单失败");
      if (d.payUrl) window.location.href = d.payUrl;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card grid gap-6 p-4 sm:p-6 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50">
          <ProductImage src={p.image} name={p.name} />
        </div>

        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-snug text-slate-900">{p.name}</h1>
          <div className="mt-2">
            <TagList tags={p.tags} type={p.type} />
          </div>
          <div className="mt-4 text-brand">
            <span className="text-base">¥</span>
            <span className="text-3xl font-bold">{unit.toFixed(2)}</span>
          </div>

          <div className="mt-5 space-y-4">
            {hasSpecs && (
              <Field label="宝贝类型">
                <div className="flex flex-wrap gap-2">
                  {p.specs.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSpec(i)}
                      className={`rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                        spec === i
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      <div className={`text-xs ${spec === i ? "text-white/70" : "text-slate-400"}`}>
                        ¥{s.price.toFixed(2)}
                      </div>
                      <div className="font-medium">{s.name}</div>
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="联系方式 *">
              <input
                className="input"
                placeholder="请输入您的联系方式（QQ / 微信 / 手机 / 邮箱）"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </Field>
            <Field label="查询密码 *">
              <input
                className="input"
                autoComplete="off"
                placeholder="设置查询订单的密码（至少 4 位，请牢记）"
                value={queryPassword}
                onChange={(e) => setQueryPassword(e.target.value)}
              />
            </Field>
            <Field label="邮箱（选填）">
              <input className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field label="购买数量">
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200">
                <button className="px-4 py-2 text-lg hover:bg-slate-50" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="w-16 border-x border-slate-200 py-2 text-center outline-none"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                />
                <button className="px-4 py-2 text-lg hover:bg-slate-50" onClick={() => setQty((q) => Math.min(99, q + 1))}>
                  ＋
                </button>
              </div>
            </Field>

            <Field label="支付方式">
              <div className="flex gap-2">
                {PAY_OPTIONS.map((o) => (
                  <button
                    key={o.code}
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
            </Field>

            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

            <button className="btn-primary w-full !py-3 text-base" onClick={buy} disabled={busy}>
              {busy ? "提交中…" : `立即购买 · ¥${total}`}
            </button>
            <p className="text-xs leading-relaxed text-slate-400">
              {p.type === "card"
                ? "付款后订单进入「发货中」，客服人工发货后，到「订单查询」输入联系方式 + 查询密码即可查看卡密。"
                : "付款后获得 CDK，在订单页上传资料文件，由后台处理。"}
            </p>
          </div>
        </div>
      </div>

      {p.description && (
        <div className="card mt-5 p-5 sm:p-6">
          <h2 className="mb-3 text-base font-semibold">宝贝详情</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            <Linkify text={p.description} />
          </div>
        </div>
      )}
    </>
  );
}

/** 把详情里的网址变成可点击链接（如视频教程） */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((s, i) =>
        /^https?:\/\//.test(s) ? (
          <a key={i} href={s} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">
            {s}
          </a>
        ) : (
          <span key={i}>{s}</span>
        )
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-slate-600">{label}</div>
      {children}
    </div>
  );
}

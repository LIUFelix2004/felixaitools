import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.SITE_NAME || "代充提交",
  description: "付费获取 CDK，提交资料，后台处理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

# 自动发卡商城 (Next.js)

一个轻量的「数字商品商城」：多商品目录 → 在线支付 → 发货 → 订单查询。卡密商品支持**人工发货**（付款后客服手动发卡），也支持**文件处理型**商品（买家付款后上传自己的资料，由后台处理）。前后台一体，自带后台管理。

> 适合卖你**自己合法的数字商品**（成品账号、激活码、兑换码、会员、代办服务等）。请勿用于收集他人账号密码 / session 等登录凭证或任何违法用途，由此产生的责任由使用者自行承担。

## 功能

**商城前台**
- 首页：公告、分类、搜索、图片商品网格
- 商品详情：大图、多规格定价、标签、商品详情（网址自动转链接）
- 下单必填「联系方式 + 查询密码」，支付方式可选
- 订单页进度条：已支付 → 发货中 → 已发货
- 订单查询：凭联系方式 + 查询密码查看卡密
- 可选右下角在线客服（二维码 / 链接）

**管理后台**（密码登录）
- 订单管理：待发货筛选、人工发货填卡密、营收统计、30 秒自动刷新
- 商品管理：分类、商品增删改、图片上传、标签、多规格、上下架
- 文件提交：文件处理型订单的资料下载与状态处理

**支付**
- `mock` 本地模拟 / `jhup` 聚合支付（服务端下单 + MD5 签名 + 异步回调 + 主动对账），接别的支付只改 `src/lib/payment.ts`

**通知**
- 新订单微信推送（PushPlus / Server酱 / 企业微信机器人，任选）

## 技术栈

Next.js 14 (App Router) + TypeScript + Tailwind；数据库用 Node 内置 `node:sqlite`（免编译），数据在 `./data/app.db`；上传文件在 `./uploads`。**需要 Node ≥ 22.5。**

## 本地运行

```bash
cp .env.example .env.local   # 按需修改
npm install
npm run seed                 # 可选：写入演示数据
npm run dev
```

- 商城：http://localhost:3000
- 后台：http://localhost:3000/admin （密码见 `.env.local` 的 `ADMIN_PASSWORD`）

默认 `PAYMENT_PROVIDER=mock`，点「去支付」直接成功，方便本地看全流程。

## 配置

所有配置在 `.env.local`（见 `.env.example` 模板）：站点名、公告、后台密码、`AUTH_SECRET`、支付（`jhup` 需 `JHUP_PID/JHUP_KEY/SITE_URL`）、微信通知、在线客服链接。

## 部署

生产部署（Node + pm2 + 反向代理 + HTTPS）见 [DEPLOY.md](DEPLOY.md)。要点：Node ≥ 22.5；`data/`、`uploads/` 为运行时数据需持久化与备份；支付回调需公网 HTTPS 可达。

## 许可证

[MIT](LICENSE)

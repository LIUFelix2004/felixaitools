# 智能代充 · 自动发卡商城

一个「多商品目录 → 在线支付 → 自动发货 → 订单查询」的自动发卡系统，参考 paocn.com / muzi-ai.shop 这类发卡网模型，并额外支持「文件处理型」商品。

## 两种商品类型

- **秒发卡密（card）**：后台把卡密/账号批量导入库存池，用户下单付款后**从库存自动发一张**，订单页直接显示。
- **文件处理（file）**：用户下单付款后得到 **CDK**，在订单页用 CDK **上传资料文件**，由后台在「文件提交」里处理、改状态、回复备注。

## 页面

- **商城首页** `/`：左侧分类，右侧商品卡片，顶部公告，点「购买」填邮箱+数量→支付。
- **订单查询 / 发货页** `/order`：支付后自动跳转并发货；也可凭**订单号或邮箱**随时找回卡密 / 上传文件。
- **管理后台** `/admin`（密码登录）：
  - **订单管理**：全部/已支付/待支付、搜索、营收统计。
  - **商品管理**：分类增删、商品增删改、上下架、**卡密库存批量导入**。
  - **文件提交**：查看文件型订单的上传资料、下载、改状态、写用户可见备注。

> ⚠️ 平台本身通用合规。请只用于销售你**自己合法的数字商品**；因购买/使用产生的责任由购买方承担。

## 技术栈

Next.js 14 (App Router) + TypeScript + Tailwind；数据库用 Node 内置 `node:sqlite`（免编译），数据在 `./data/app.db`；上传文件在项目外的 `./uploads`（仅管理员可下载）。

## 本地运行（Node ≥ 22.5，已测 24）

```bash
npm install
npm run seed      # 写入演示数据（分类/商品/库存），可选
npm run dev
```

- 商城：http://localhost:3000
- 后台：http://localhost:3000/admin （默认密码 `admin123`，见 `.env.local`）

当前支付为 `mock` 模拟（点「去支付」直接成功发货，仅测试用）。

## 配置（`.env.local`）

| 变量 | 说明 |
|------|------|
| `SITE_NAME` / `NEXT_PUBLIC_SITE_NAME` | 站点名称 |
| `NEXT_PUBLIC_SHOP_NOTICE` | 首页公告（`\n` 换行） |
| `ADMIN_PASSWORD` | 后台密码（**务必修改**） |
| `AUTH_SECRET` | 登录态签名密钥（改成长随机串） |
| `PAYMENT_PROVIDER` | `mock`（测试）或 `jhup`（聚合支付 pay.jhup.cn） |
| `JHUP_PID` / `JHUP_KEY` | jhup 商户编号(2088开头)与密钥 |
| `JHUP_API_URL` / `SITE_URL` | 平台地址、你的公网 https 域名 |

## 接真实支付（jhup 聚合支付 pay.jhup.cn）

1. `.env.local` 设 `PAYMENT_PROVIDER=jhup`，填 `JHUP_PID`、`JHUP_KEY`、`SITE_URL`（公网 https）。
2. 用户下单 → 服务端 POST `/openapi/pay/create` 拿 `pay_url` 跳转支付。
3. 支付成功平台异步 POST 回调 `/api/pay/jhup/notify`（MD5 验签，`trade_status=TRADE_SUCCESS` 时发货，返回 `success`）。
4. 用户支付后跳回 `/order?order=订单号`，页面轮询并**主动对账**（调 `/openapi/pay/query`），回调延迟也能及时发货。

签名：除 sign/sign_type 外去空值、按键名升序拼 `k=v&...&key=密钥`，MD5 转大写（见 `src/lib/payment.ts`）。支付方式 `paytype_code`：alipay / wxpay / qqpay / unionpay / usdt 等。

## 目录结构

```
src/
  app/
    page.tsx                 商城首页（分类+商品+购买）
    order/page.tsx           订单查询 / 发货 / 文件上传
    admin/                   后台：Dashboard + tabs/{Orders,Products,Submissions}
    api/
      catalog/               公开商品目录
      orders/  order/query/  下单、订单查询
      pay/{mock,epay}/       支付与回调
      submit/ progress/ cdk/ 文件提交相关
      admin/{orders,products,categories,cards,submissions,files,login,logout}/
  lib/ db.ts shop.ts orders.ts cdk.ts payment.ts auth.ts storage.ts
scripts/seed.mjs             演示数据
```

## 上线前检查

1. 改 `.env.local`：`ADMIN_PASSWORD`、`AUTH_SECRET`、`SITE_URL`、公告。
2. 接真实支付（`epay`）。
3. 清空演示数据：删 `data/` 和 `uploads/`，重启自动建空库（或 `npm run seed` 重置演示）。
4. `npm run build && npm run start`，用 pm2/nssm 保活。
5. Nginx 反代 + HTTPS（支付回调需公网 HTTPS），域名解析到服务器。
6. `data/`（订单/卡密/提交）和 `uploads/`（文件）务必持久化 + 定期备份。
```

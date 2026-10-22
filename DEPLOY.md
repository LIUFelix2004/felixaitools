# 宝塔面板部署指南（felixaitools.shop）

本项目是 Next.js 全栈应用，数据库用 Node 内置 `node:sqlite`，**必须 Node ≥ 22.5（推荐 Node 20 不行，装 Node 22 LTS 或 24）**。

---

## 0. 准备：服务器 + 域名解析

- 一台 Linux 服务器（已装宝塔面板）。
- 域名 `felixaitools.shop` 的 A 记录解析到服务器公网 IP（含 `@` 和 `www`）。
- 安全组/防火墙放行 `80`、`443`。

---

## 1. 宝塔装环境

宝塔「软件商店」里安装：

1. **Nginx**（做反向代理）
2. **PM2 管理器**（Node 项目守护）—— 装好后进入 PM2 管理器，**Node 版本管理 → 安装 Node 22 或 24**，并设为默认。
   > ⚠️ 关键：`node:sqlite` 需要 Node ≥ 22.5。用 `node -v` 确认，低于这个版本会报错起不来。

---

## 2. 上传代码

把本地项目（除了 `node_modules`、`.next`、`data`、`uploads`）传到服务器，例如 `/www/wwwroot/felixaitools`。

- 方式一：本地 `git init` 推到 GitHub，再在服务器 `git clone`。
- 方式二：本地打包上传——**不要带** `node_modules`/`.next`/`data`/`uploads`，宝塔「文件」里上传 zip 后解压。

---

## 3. 配置 `.env.local`（生产值）

在项目根目录建 `.env.local`（宝塔文件管理器可直接编辑），内容：

```bash
SITE_NAME=智能代充提交
NEXT_PUBLIC_SITE_NAME=智能代充提交
NEXT_PUBLIC_SHOP_NOTICE=本店全自动发货，付款后立即到账。\n如付款后未跳转到发货页，可用右上角「订单查询」凭订单号/邮箱找回。

# 后台（务必改成强密码 + 长随机串）
ADMIN_PASSWORD=换成你的强密码
AUTH_SECRET=换成一段很长的随机字符串

# 支付：正式收款用 jhup
PAYMENT_PROVIDER=jhup
JHUP_API_URL=https://pay.jhup.cn
JHUP_PID=你的商户编号(2088开头)
JHUP_KEY=你的MD5商户密钥
SITE_URL=https://你的域名
```

> 密钥建议在 jhup 商户后台重置一次再填，避免用调试期泄露过的旧密钥。

---

## 4. 安装依赖 + 构建

SSH 或宝塔「终端」进入项目目录：

```bash
cd /www/wwwroot/felixaitools
npm install
npm run build
```

（首次想要演示商品可选 `npm run seed`；正式用则跳过，直接进后台自己加商品。）

---

## 5. PM2 启动

宝塔「PM2 管理器 → 添加项目」：

- 运行目录：`/www/wwwroot/felixaitools`
- 启动文件 / 方式：`npm`，参数 `run start`（即跑 `next start`，默认端口 **3000**）
- Node 版本：选 22 或 24
- **实例数：1**（SQLite 单写，别开 cluster 多实例）

或命令行：

```bash
cd /www/wwwroot/felixaitools
pm2 start npm --name felixaitools -- run start
pm2 save
```

启动后本机 `curl http://127.0.0.1:3000` 能返回页面即正常。

---

## 6. 宝塔建站 + 反向代理 + SSL

1. 「网站 → 添加站点」，域名填 `felixaitools.shop`（和 `www.felixaitools.shop`），**不要**建数据库、PHP 选纯静态即可。
2. 该站点「设置 → 反向代理 → 添加反向代理」：
   - 目标 URL：`http://127.0.0.1:3000`
   - 发送域名：`$host`
3. 「设置 → SSL → Let's Encrypt」一键申请并**开启强制 HTTPS**。

### ⚠️ 必须加大上传体积限制

本项目「文件处理型」商品要上传文件（最大 10MB），而 Nginx 默认只允许 1MB。
在该站点「设置 → 配置文件」里，`server { }` 段内加一行（或改大）：

```nginx
client_max_body_size 20m;
```

保存后重载 Nginx。不加这行，上传稍大文件会报 413。

---

## 7. 验收上线

1. 打开 `https://felixaitools.shop` → 商城正常、有 HTTPS 锁。
2. 进 `https://felixaitools.shop/admin` → 用新密码登录 → 加分类、商品、导入卡密。
3. 真买一笔小额（¥1）走通支付 → 支付成功应自动跳回订单页并发货。
4. 后台「订单管理」能看到这笔已支付、营收 +1。

> jhup 商户后台如需配置「异步通知地址/回调域名白名单」，填：
> `https://felixaitools.shop/api/pay/jhup/notify`

---

## 8. 日常维护

- **数据就是这两处**：`data/app.db`（订单/卡密/商品/提交）、`uploads/`（用户上传文件）。
  宝塔「计划任务」加个每日打包备份这两个目录。
- 更新代码后：`git pull`（或重传）→ `npm install` → `npm run build` → `pm2 restart felixaitools`。
- 改了 `.env.local` 也要 `pm2 restart felixaitools` 才生效。
- 查日志：PM2 管理器里看，或 `pm2 logs felixaitools`。

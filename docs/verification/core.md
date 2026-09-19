# 核心版本验证记录

验证日期：2026-09-19
环境：Windows，本地工作树 `D:\PWA_Web_App`

## 已执行

| 命令/检查 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | TypeScript 无错误 |
| `npm run lint` | 通过 | ESLint 无错误或警告 |
| `npm test` | 通过 | 14 个测试文件、46 个测试全部通过 |
| `npm run build` | 通过 | Next.js 16.3.5 生产构建成功，21 个路由生成，包含 `/photos` |
| `git diff --check` | 通过 | 未发现空白错误 |
| 本地生产服务器 `/sw.js` | 通过 | HTTP 200；JavaScript；`no-cache, no-store, must-revalidate`；`X-Frame-Options: DENY` |
| 本地生产服务器 `/manifest.webmanifest` | 通过 | HTTP 200；`application/manifest+json` |
| `npm run test:e2e`（HTTP/API 部分） | 部分通过 | 5 个 PWA manifest/service-worker 测试通过 |

构建验证使用占位的公开 Supabase URL 与 Publishable Key，只验证编译和路由生成，不代表后端可连接。

## 尚未执行

| 检查 | 状态 | 原因/后续动作 |
| --- | --- | --- |
| `supabase db push --dry-run` / `db push` | 未验证 | 尚未提供并连接目标 Supabase project ref |
| `supabase db lint --linked --level error` | 未验证 | 同上 |
| `supabase test db --linked` | 未验证 | 同上；pgTAP 文件未在真实 PostgreSQL 执行 |
| Playwright 页面/响应式 E2E | 环境受限 | 10 项用例未启动：本机缺少 Chromium；约 196MB 安装包下载长时间无进度后已终止 |
| 浏览器端注册、登录、计划和打卡 E2E | 未验证 | 需要真实 Supabase 环境与测试账号；当前仅覆盖公开页和 PWA 基础 |
| Lighthouse/真实设备安装 | 未验证 | 需要 HTTPS 部署或生产预览 |
| Vercel 部署 | 未执行 | 按用户要求，推送 GitHub 并创建 Supabase 后再部署 |
| Supabase Edge Functions 本地执行 | 环境受限 | 本机没有 Deno，Supabase 本地运行依赖 Docker；函数源码与固定版本依赖已编写但未执行 |
| Web Push 实机收发 | 未验证 | 需要 HTTPS、真实 VAPID keys、已部署 Edge Functions、Cron 和支持 Push 的设备 |
| 私有照片 Storage/RLS/Signed URL | 未验证 | 需要在真实 Supabase 测试项目执行迁移，并用两名用户和匿名窗口验证隔离 |
| 浏览器照片重编码与 EXIF/GPS 清除 | 未做真机样本验证 | 代码通过 Canvas 重新编码；部署后需用含 EXIF/GPS 的 JPEG 在目标移动浏览器核验输出文件 |

## 结论

前端静态检查、单元测试、生产构建、照片输入校验、PWA 路由和响应头已通过。本报告不把 SQL 文本检查或 Canvas 源码检查等同于数据库及真机验证；上线门槛是目标 Supabase 上迁移、lint、pgTAP、照片隔离和完整用户流程全部通过。

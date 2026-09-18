# 核心版本验证记录

验证日期：2026-09-18  
环境：Windows，本地工作树 `D:\PWA_Web_App\.worktrees\workout-pwa-core`

## 已执行

| 命令/检查 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | TypeScript 无错误 |
| `npm run lint` | 通过 | ESLint 无错误或警告 |
| `npm test` | 通过 | 10 个测试文件、38 个测试全部通过 |
| `npm run build` | 通过 | Next.js 16.3.5 生产构建成功，16 个路由生成 |
| `git diff --check` | 通过 | 未发现空白错误 |
| 本地生产服务器 `/sw.js` | 通过 | HTTP 200；JavaScript；`no-cache, no-store, must-revalidate`；`X-Frame-Options: DENY` |
| 本地生产服务器 `/manifest.webmanifest` | 通过 | HTTP 200；`application/manifest+json` |
| `npm run test:e2e`（HTTP/API 部分） | 部分通过 | 5 个 PWA manifest/service-worker 测试通过 |

构建验证使用占位的公开 Supabase URL 与 anon key，只验证编译和路由生成，不代表后端可连接。

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

## 结论

前端静态检查、单元测试、生产构建、PWA 路由和响应头已通过。本报告不把 SQL 文本检查等同于数据库验证；上线门槛是目标 Supabase 上迁移、lint、pgTAP 和完整用户流程全部通过。

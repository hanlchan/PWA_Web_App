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
| `npm run test:e2e` | 通过 | 复用本机 Edge，15 项全部通过；覆盖桌面及 320/375/390/430 五种视口、登录页无横向滚动、离线页与 PWA 静态资源 |
| `npx supabase db push` | 通过 | 云端项目已应用 `0001`–`0014`，未执行 seed |
| `npm run db:lint` | 通过 | 云端 `public` 业务 schema 无 error；命令配置为 error 时失败 |
| 云端 pgTAP | 通过 | 11 个 SQL 测试文件、117 个断言通过；全部事务回滚，无测试夹具残留 |
| `npm run db:test` 一键云端运行器 | 部分验证 | PowerShell 语法、超时终止与重试逻辑已验证；因 Management API 在连续查询后短暂无响应，尚未再完成一次整套串行重跑 |
| Publishable Key 公开 RPC | 通过 | 公开资料与公开照片 RPC 均返回 HTTP 200；不存在用户返回 `null`/空数组 |

构建验证使用占位的公开 Supabase URL 与 Publishable Key，只验证编译和路由生成，不代表后端可连接。

## 尚未执行

| 检查 | 状态 | 原因/后续动作 |
| --- | --- | --- |
| 浏览器端注册、登录、计划和打卡 E2E | 未验证 | 需要真实 Supabase 环境与测试账号；当前仅覆盖公开页和 PWA 基础 |
| Lighthouse/真实设备安装 | 未验证 | 需要 HTTPS 部署或生产预览 |
| Vercel 部署 | 未执行 | 按用户要求，待推送 GitHub 并完成云端真实用户流程后再部署 |
| Supabase Edge Functions 本地执行 | 环境受限 | 本机没有 Deno，Supabase 本地运行依赖 Docker；函数源码与固定版本依赖已编写但未执行 |
| Web Push 实机收发 | 未验证 | 需要 HTTPS、真实 VAPID keys、已部署 Edge Functions、Cron 和支持 Push 的设备 |
| 私有照片 Signed URL 真文件流程 | 未验证 | 表、Storage 策略和跨用户 RLS 已通过 pgTAP；仍需用真实登录用户上传文件并验证短时 URL |
| 浏览器照片重编码与 EXIF/GPS 清除 | 未做真机样本验证 | 代码通过 Canvas 重新编码；部署后需用含 EXIF/GPS 的 JPEG 在目标移动浏览器核验输出文件 |

## 结论

前端静态检查、单元测试、生产构建、照片输入校验、PWA 路由和响应头已通过；云端迁移、业务 schema lint、117 项 pgTAP 和 Publishable Key 公开 RPC 也已通过。仍不能把 Canvas 源码检查等同于真机验证；上线前还需完成真实注册登录、照片文件、Edge Functions、Web Push 和完整用户流程。

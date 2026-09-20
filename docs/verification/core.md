# 核心版本验证记录

验证日期：2026-09-20

环境：Windows，本地工作树 `D:\PWA_Web_App`，已链接个人 Supabase 云项目

数据约束：只创建临时测试用户与关联数据，测试后清理；13 张业务表最终计数均为 0

## 已执行

| 命令/检查 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | TypeScript 退出码 0 |
| `npm run lint` | 通过 | ESLint 退出码 0 |
| `npm test` | 通过 | 19 个测试文件、56 项全部通过 |
| `npm run build` | 通过 | Next.js 16.3.5 生产构建成功，21 个静态/动态路由生成完成 |
| `npm run test:e2e` | 通过 | 复用本机 Edge；15 项公开页/PWA/响应式测试通过，10 项 live 用例因未启用 live 标志而跳过 |
| 真实浏览器主流程 | 通过 | 真实 Supabase 登录、引导、创建计划、打卡、日期详情、退出全部通过；真实注册邮件用例未配置收件箱而跳过 |
| `npx supabase db push` | 通过 | 云端项目已应用 `0001`–`0016`，未执行 seed |
| `npm run db:lint` | 通过 | 云端 `public` schema 无 error |
| `npm run db:test` | 通过 | 13 个 pgTAP 文件、125 条断言全部通过，每个文件都在事务中回滚 |
| `npm run test:live` | 通过 | 覆盖两个临时用户、四种周期、日期边界、打卡详情、RLS、公开资料、体重隐私、关注/点赞/催促/通知、私密/公开照片 Signed URL；`finally` 清理完成 |
| 新版 Secret Key | 通过 | Edge Functions 从 `SUPABASE_SECRET_KEYS.default` 读取 Secret Key；`0016` 授予后可访问必要业务表 |
| Legacy keys 停用 | 通过 | 官方 Management API 返回 `enabled: false`；传播后 legacy `anon`/`service_role` 均返回 401，新版 Publishable/Secret Key 均保持正常 |
| Edge Functions | 通过 | 两个函数均为 ACTIVE；无 Cron Secret 返回 401；授权调用返回 HTTP 200，`processedPlans: 0`、`claimed: 0`、`sent: 0` |
| Vault + Cron | 通过 | Vault 只保存项目 URL 和 Cron Secret；提醒每分钟、实例生成每日 02:15 UTC；`pg_net` 已连续收到提醒函数 HTTP 200 |
| 云端清理核对 | 通过 | `profiles` 到 `progress_photos` 全部 13 张业务表计数均为 0 |

## 尚未执行

| 检查 | 状态 | 原因/后续动作 |
| --- | --- | --- |
| 真实注册确认邮件 | 未验证 | 需要可收件的测试邮箱与已配置的 SMTP；代码已区分“立即会话”与“等待邮箱确认” |
| 密码重置邮件全链路 | 未验证 | 需要真实收件箱验证 PKCE 回调 |
| Web Push 实机收发 | 未验证 | VAPID、Edge Functions 和 Cron 已配置；仍需 HTTPS 部署与支持 Push 的真实设备 |
| Lighthouse/真实设备安装 | 未验证 | 需要 HTTPS 部署或生产预览 |
| JPEG EXIF/GPS 真机样本 | 未验证 | Canvas 重编码已实现，仍需含定位信息的样本在目标移动浏览器验证 |
| GitHub 推送 | 未执行 | 当前仓库未配置 remote，需要 GitHub 仓库地址或 GitHub 集成 |
| Vercel 部署 | 未执行 | 按用户要求，推送 GitHub 后在进入 Vercel 部署前停止 |

## 结论

本地静态检查、单元测试、生产构建、公开页响应式测试、真实 Supabase 用户主流程、云端迁移、RLS/RPC/Storage 集成、Edge Functions 与每分钟 Cron 链路均已获得本轮实际运行证据。不把未配置收件箱、HTTPS 实机 Web Push、Lighthouse、真机 EXIF 或 Vercel 部署声称为已验证。

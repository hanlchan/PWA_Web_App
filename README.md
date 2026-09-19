# 好友运动打卡 PWA

面向手机的中文运动计划与打卡 Web App。当前版本包括邮箱注册/登录、资料初始化、自定义周期计划、未来 90 天日程、一键打卡、撤销、日历、统计、公开打卡主页、私密体重/BMI、归一化公开体重趋势、私有进度照片、关注动态、点赞、每日催促、通知中心、Web Push、自动补足日程、个人设置和可安装 PWA。Web 端只负责计划和记录，不包含“打开视频”或外部视频链接。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS
- Supabase Auth、PostgreSQL、RLS、Storage
- Vitest、Testing Library、Playwright、pgTAP
- Vercel 部署目标

## 本地启动

需要 Node.js 20.9+ 和 npm。安装依赖后，从示例文件创建本地环境文件：

```powershell
npm install
Copy-Item .env.example .env.local
```

填写 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

不要在本项目或浏览器变量中放入 `SUPABASE_SERVICE_ROLE_KEY`。然后运行：

```powershell
npm run dev
```

## 配置 Supabase

1. 在 Supabase Dashboard 创建项目，并确认将测试放在空白测试项目或数据库分支，避免影响生产数据。
2. Authentication 中配置站点 URL 和允许的重定向 URL：本地为 `http://localhost:3000/auth/callback`，部署后添加正式域名。
3. 如果希望注册后立即进入应用，可关闭邮箱确认；若保留邮箱确认，需要先完成邮件验证再登录。
4. 登录 Supabase CLI，链接项目并先查看 dry run：

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
npm run db:lint
npm run db:test
```

迁移会创建业务表、RLS、RPC、公开读取/本人写入的 `avatars` 桶，以及永久保持私有的 `progress-photos` 桶。照片部署和隔离验证见 [照片存储部署说明](docs/deployment/photos.md)。迁移成功后重新生成类型：

```powershell
npx supabase gen types typescript --linked | Set-Content -Encoding utf8 src/lib/types/database.ts
```

提交生成类型前，请再次执行前端验证。

Web Push 还需要 VAPID、Edge Functions、Vault 和 Cron。按 [Push 与 Cron 部署说明](docs/deployment/push-and-cron.md) 配置；任何私钥和 service-role 都不得进入浏览器或 Git。

## 验证

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run db:lint
npm run db:test
git diff --check
```

数据库命令必须在已链接的测试项目上运行。`npm run db:test` 通过 Supabase Management API 在云端逐个执行 pgTAP 文件，每个测试都以 `BEGIN` 开始并以 `ROLLBACK` 结束，不依赖 Docker，也不会保留测试夹具；如需 CLI 的 Docker 测试运行器，可使用 `npm run db:test:docker`。当前准确状态见 [核心验证记录](docs/verification/core.md)，RLS 设计见 [安全说明](docs/security/rls.md)。

## GitHub 与 Vercel

将功能分支合并到主分支并推送 GitHub 后，在 Vercel 导入仓库，设置上述三个公开环境变量。生产环境必须把 `NEXT_PUBLIC_SITE_URL` 改为实际 HTTPS 域名，并在 Supabase Auth 中同步添加正式回调地址。Vercel 构建命令使用 `npm run build`。

部署后检查：注册/登录、密码重置、四种计划周期、一键打卡与撤销、日历统计、PWA 安装、离线页，以及浏览器 Cache Storage 中不存在登录后的 HTML 或 Supabase 响应。

## 回滚

- 前端：在 Vercel 回滚到上一成功部署。
- 数据库：迁移包含表和函数变更，不建议直接删除生产数据。先备份，在测试分支演练逆向 SQL，再经人工确认执行。
- 密钥泄露：立即在 Supabase 轮换对应密钥，清理 Git 历史并重新部署。Publishable Key 可用于浏览器但仍必须依赖 RLS；任何 Secret Key 或 service-role key 一旦泄露必须立即轮换。

## 当前范围

进度照片代码已完成，但 Storage/RLS 必须在真实 Supabase 测试项目验证后才能视为可用。Web Push、Edge Functions 和 Cron 同样必须在真实 Supabase 与 HTTPS 设备环境完成部署验证。真实体重仅本人可访问，公开页面只读取数据库生成的归一化趋势和用户主动公开的照片。好友动态仅返回安全聚合字段。

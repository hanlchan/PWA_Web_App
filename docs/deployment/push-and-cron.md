# Web Push 与定时任务部署

## 1. 生成 VAPID keys

在可信环境生成一对 VAPID keys，例如：

```powershell
npx web-push generate-vapid-keys
```

公钥配置两处：Vercel 的 `VAPID_PUBLIC_KEY`，以及 Supabase Edge Function secret。私钥只能进入 Supabase secret，禁止提交 Git 或配置为 `NEXT_PUBLIC_*`。

## 2. 配置 Edge Function secrets

创建一个足够长的随机 `WORKOUT_CRON_SECRET`，然后在已链接项目中执行：

```powershell
npx supabase secrets set WORKOUT_CRON_SECRET="..." VAPID_SUBJECT="mailto:你的邮箱" VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..."
```

托管运行时会提供 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEYS`。函数从 `SUPABASE_SECRET_KEYS` JSON 中读取 `default` 新版 Secret Key，不依赖 legacy `SUPABASE_SERVICE_ROLE_KEY`。不要把 Secret Key 写入前端环境文件。

## 3. 部署函数

```powershell
npx supabase functions deploy generate-occurrences
npx supabase functions deploy send-workout-reminders
```

两个函数都设置为 `verify_jwt=false`，但会严格校验 Vault 中对应的 `x-cron-secret`；没有该请求头无法执行任务。

## 4. 配置 Vault 和 Cron

在 Supabase SQL Editor 中创建两个 Vault secrets：

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('与 Edge Function 相同的随机密钥', 'workout_cron_secret');
```

随后执行 [`supabase/cron/setup.sql`](../../supabase/cron/setup.sql)。它会创建：

- 每分钟执行一次 `send-workout-reminders`
- 每天 02:15 UTC 执行一次 `generate-occurrences`

`setup.sql` 会在重建前精确取消同名任务，可重复执行而不会叠加调度。运行历史位于 `cron.job_run_details`。

## 5. 验收

1. 使用 HTTPS 部署地址登录，打开设置页。
2. 由用户主动点击“开启运动提醒”；不应在页面加载时自动弹权限框。
3. 检查 `push_subscriptions` 仅出现当前用户记录。
4. 建立几分钟内到期的测试 occurrence，手动调用提醒函数。
5. 验证通知标题、点击后回到应用、`reminder_sent_at` 更新及应用内通知生成。
6. 将订阅置为失效后，确认 404/410 响应会清理该 endpoint。
7. 拒绝通知权限时，计划、打卡和应用内通知仍须正常工作。

仓库不保存真实 VAPID keys。请在 Supabase Edge Secret 和 Vercel 环境变量中分别配置所需的公开/私密值。

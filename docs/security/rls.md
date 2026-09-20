# 数据访问与 RLS 安全说明

## 信任边界

浏览器只使用 `NEXT_PUBLIC_SUPABASE_URL` 和新版 Publishable Key。Publishable Key 不是用户授权凭据；实际身份来自 Supabase Auth JWT，数据库以 `auth.uid()` 作为所有权边界。项目不包含、也不允许前端读取 Secret Key 或 service-role key。

Server Action 同样使用当前请求 Cookie 创建 Supabase 客户端，不绕过 RLS。事务型写入通过固定 `search_path` 的数据库函数完成，函数内部从 `auth.uid()` 推导用户，不接受任意 `user_id`。

PostgreSQL 会先检查表级权限，再应用 RLS。迁移 `0014_table_api_grants.sql` 显式授予 `authenticated` 业务表操作权限，实际可见和可修改行仍由下表中的 RLS 策略限制；`anon` 只额外获得公开照片元数据的 `SELECT`，私密行仍无法匹配策略。`0016_service_role_table_grants.sql` 只为受信任的后端/Edge Functions 授予业务表权限；Secret Key 对应的 `service_role` 可绕过 RLS，绝不能进入浏览器。

## 表与策略

| 对象 | 直接访问角色 | 所有权条件 | 说明 |
| --- | --- | --- | --- |
| `profiles` | `authenticated` | `id = auth.uid()` | 用户只能读、建、改自己的私有资料 |
| `profile_settings` | `authenticated` | `user_id = auth.uid()` | 身高、时区和隐私开关不公开 |
| `workout_plans` | `authenticated` | `user_id = auth.uid()` | 计划只对本人可见 |
| `plan_custom_dates` | `authenticated` | 所属计划的 `user_id = auth.uid()` | 防止跨计划注入日期 |
| `plan_occurrences` | `authenticated` | `user_id = auth.uid()` | 打卡日程只对本人可见 |
| `checkins` | `authenticated` | `user_id = auth.uid()` | 当前核心版本不公开打卡详情 |
| `weight_entries` | `authenticated` | `user_id = auth.uid()` | 真实公斤数、BMI 和时间严格仅本人可读写 |
| `follows` | `authenticated` | 仅关系参与者可读，本人可关注/取消关注 | 禁止关注自己 |
| `checkin_likes` | `authenticated` | 点赞人只能直接读删自己的点赞 | 点赞他人通过校验关注关系的 RPC |
| `notifications` | `authenticated` | `user_id = auth.uid()` | 仅接收人可读和标记已读 |
| `nudges` | `authenticated` | 发送者或接收者 | RPC 强制关注关系、待完成计划和每日一次 |
| `push_subscriptions` | `authenticated` | `user_id = auth.uid()` | endpoint 和加密密钥严格仅本人访问 |
| `progress_photos` | 本人；显式公开记录允许 `anon`/`authenticated` 只读 | 本人写入；公开读取要求 `visibility = public` | 默认私密，私密记录不会被公开查询 |
| `storage.objects/avatars` | 公开读、本人写 | 首级目录等于 `auth.uid()` | 头像属于公开展示数据，上传仍限本人目录 |
| `storage.objects/progress-photos` | 本人；显式公开照片可读 | 首级目录等于 `auth.uid()`；公开读取由数据库记录判定 | bucket 永久保持 private，页面只使用 10 分钟 Signed URL |

所有业务表均显式启用 RLS。照片表是唯一面向 `anon` 的业务表读取策略，而且只匹配用户主动设为 `public` 的记录。

## RPC 权限

`complete_onboarding` 使用 `security invoker`，依赖表级 RLS。计划、日程、打卡、统计函数仅向 `authenticated` 授予执行权；内部日程展开函数撤销了 `public`、`anon` 和 `authenticated` 的直接执行权。

安全定义者函数必须同时满足：固定 `search_path`、读取 `auth.uid()`、对目标行校验所有者。`reschedule_future_notifications` 虽接收用户 ID，但要求参数严格等于 `auth.uid()`。

## 已知边界

- 头像桶是公开读；不要把私密照片放入该桶。
- 公开体重函数只返回日期和以首条数据为 100 的归一化指数；函数返回签名不含公斤数、身高、BMI 或基准值。
- 好友动态 RPC 只返回公开身份、打卡日期、累计天数和点赞数，不返回打卡备注、运动详情或体重。
- VAPID 私钥和新版 Supabase Secret Key 只存在 Supabase Edge Function secrets；浏览器通过登录后路由取得 VAPID 公钥，且仅在用户点击后申请通知权限。
- 照片上传会在浏览器 Canvas 中重新编码，移除原始 EXIF/GPS；Storage 同时限制 MIME、10 MB 大小和用户目录。公开照片仍位于私有 bucket，只通过短时 Signed URL 访问。
- 云端项目已执行 `0001`–`0016`、schema lint、13 个 pgTAP 文件/125 条断言与临时用户集成测试；测试数据已清理，准确证据见核心验证记录。
- 云端 legacy `anon`/`service_role` API keys 已停用；客户端使用 Publishable Key，受信任后端使用 Secret Key。

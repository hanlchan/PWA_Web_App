# 数据访问与 RLS 安全说明

## 信任边界

浏览器只使用 `NEXT_PUBLIC_SUPABASE_URL` 和 anon key。anon key 不是授权凭据；实际身份来自 Supabase Auth JWT，数据库以 `auth.uid()` 作为所有权边界。项目不包含、也不允许前端读取 service-role key。

Server Action 同样使用当前请求 Cookie 创建 Supabase 客户端，不绕过 RLS。事务型写入通过固定 `search_path` 的数据库函数完成，函数内部从 `auth.uid()` 推导用户，不接受任意 `user_id`。

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
| `storage.objects/avatars` | 公开读、本人写 | 首级目录等于 `auth.uid()` | 头像属于公开展示数据，上传仍限本人目录 |

所有业务表均显式启用 RLS。没有面向 `anon` 的业务表策略。

## RPC 权限

`complete_onboarding` 使用 `security invoker`，依赖表级 RLS。计划、日程、打卡、统计函数仅向 `authenticated` 授予执行权；内部日程展开函数撤销了 `public`、`anon` 和 `authenticated` 的直接执行权。

安全定义者函数必须同时满足：固定 `search_path`、读取 `auth.uid()`、对目标行校验所有者。`reschedule_future_notifications` 虽接收用户 ID，但要求参数严格等于 `auth.uid()`。

## 已知边界

- 头像桶是公开读；不要把私密照片放入该桶。
- 公开体重函数只返回日期和以首条数据为 100 的归一化指数；函数返回签名不含公斤数、身高、BMI 或基准值。
- 当前版本仍没有好友动态或照片记录表，因此不存在这些数据的公开接口。
- SQL 已完成静态检查和 pgTAP 测试文件编写，但在连接实际 Supabase 项目前不能宣称迁移、RLS 或 RPC 已经数据库实测。
- 生产上线前必须在独立测试项目或 Supabase 分支执行全部迁移、`db lint` 与 pgTAP，不能对含生产数据的项目直接运行测试夹具。

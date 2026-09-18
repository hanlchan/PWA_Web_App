# 好友运动打卡 PWA：核心闭环设计

日期：2026-09-18

状态：已由用户逐节确认

范围：第一子项目——项目基础、认证、个人资料、运动计划、Occurrence、首页一键打卡、日历与核心统计

## 1. 背景与目标

本项目是面向真实多用户长期使用的中文移动端优先 PWA，最终部署到 Vercel 与 Supabase。第一子项目建立完整的“用户自行安排 → 系统生成执行实例 → 当日一键完成 → 查看日历与统计”闭环。

以下约束不可更改：

- 不生成任何默认运动计划。
- 计划日期、时间和内容全部由用户决定。
- 打卡默认一次点击完成，补充内容全部可选。
- 打卡日期和累计打卡天数默认公开；公开能力在第二子项目实现。
- 真实体重严格私密；体重能力在第二子项目实现。
- 照片默认私密；照片能力在第四子项目实现。
- 未设置计划时间时，提醒时间默认为用户当地 20:00。
- 产品不承载运动视频、课程或外部网页跳转，计划中不设置 URL 字段。

## 2. 项目分解

完整产品拆为四个连续交付的子项目：

1. 核心闭环：基础工程、认证、资料、计划、Occurrence、首页打卡、日历、统计。
2. 隐私公开层：公开主页、公开打卡、私人重量、归一化公共体重趋势。
3. 社交与通知：关注、动态、点赞、催促、PWA Push、Cron、Edge Functions。
4. 照片与上线：私有 Storage、照片权限、全量安全测试、GitHub、Vercel 和生产部署。

每个子项目均独立完成规格、实现计划、编码和验证。最终交付仍为同一个完整应用。

## 3. 技术方案

采用 Next.js 服务端优先与 Supabase 数据库安全能力结合的方案：

- Next.js App Router、TypeScript、Tailwind CSS。
- Server Components 负责首屏读取；Server Actions 负责同源表单写入。
- 浏览器组件只处理交互、日历选择、会话 UI 和后续 Push 注册。
- Supabase Auth 管理邮箱密码账号。
- PostgreSQL RLS、约束与事务型 RPC 是最终授权边界。
- 聚合、统计、计划同步和公开安全数据由 RPC 或安全视图提供。
- Vercel 只承载 Next.js，不另建传统服务器。

浏览器中只允许以下公开环境变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` 不进入浏览器包，也不用于普通用户请求。后续 Edge Functions 所需秘密通过 Supabase Secrets 保存。

## 4. 认证与首次使用

注册方式为邮箱加密码，Supabase 项目关闭注册邮件确认。流程如下：

1. 用户在 `/register` 注册。
2. 注册成功后立即建立会话并跳转 `/onboarding`。
3. 用户填写唯一用户名、昵称、可选身高和时区。
4. 时区由浏览器优先识别为 IANA 标识，例如 `Asia/Shanghai`，用户可修改。
5. 资料事务创建成功后进入首页。
6. 首页保持空状态：“你还没有安排运动计划”，仅提供“创建第一个计划”。

邮箱只保存在 `auth.users`，不会复制到 `profiles` 或任何公共对象。Next.js Proxy（旧版本称 Middleware）只刷新会话和保护路由；RLS 与数据库函数负责真实权限判断。

头像为可选公开资料。第一子项目建立单独的 `avatars` bucket，接受 JPEG、PNG、WebP，限制 5MB；上传前缩放并重新编码以移除 EXIF，Storage 策略只允许用户写入自己的目录。进度照片不复用该 bucket，仍在第四子项目使用私有 bucket 实现。

用户名规范：3 至 30 个字符，仅允许小写英文字母、数字和下划线，以小写英文字母或数字开头和结尾。数据库使用不区分大小写的唯一约束，输入保存前转为小写。

## 5. 核心数据模型

### 5.1 ER 关系

```text
auth.users 1──1 profiles 1──1 profile_settings
    │
    ├──N workout_plans 1──N plan_custom_dates
    │        │
    │        └──N plan_occurrences 1──0..1 checkins
    │
    └──N checkins  (occurrence_id 可空，支持临时打卡)
```

### 5.2 核心表

`profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `username citext unique not null`
- `display_name varchar(50) not null`
- `avatar_path text null`，指向公开头像 bucket 中的用户作用域对象
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`profile_settings`

- `user_id uuid primary key references profiles(id) on delete cascade`
- `height_cm numeric(5,2) null`
- `timezone text not null`
- 后续子项目需要的隐私开关使用安全默认值创建，但第一子项目不开放 UI
- `public_weight_trend boolean not null default false`
- `public_workout_details boolean not null default false`
- `photo_default_visibility text not null default 'private'`
- `push_enabled boolean not null default false`

`workout_plans`

- `id uuid primary key`
- `user_id uuid not null`
- `title varchar(100) not null`
- `description text null`
- `duration_minutes integer null check (duration_minutes between 1 and 1440)`
- `recurrence_type`：`one_time | weekly | monthly | custom_dates`
- `start_date date not null`
- `end_date date null`
- `days_of_week smallint[] null`，使用 ISO 1 至 7
- `days_of_month smallint[] null`，范围 1 至 31；不存在的月日自然跳过
- `start_time time null`
- `reminder_enabled boolean not null default true`
- `notes text null`
- `created_at`、`updated_at`、`deleted_at`

计划不包含 `external_url`，也不提供视频或网页跳转能力。

`plan_custom_dates`

- `id uuid primary key`
- `plan_id uuid not null on delete cascade`
- `scheduled_date date not null`
- 唯一约束 `(plan_id, scheduled_date)`

`plan_occurrences`

- `id uuid primary key`
- `plan_id uuid not null`
- `user_id uuid not null`
- `scheduled_date date not null`
- `scheduled_time time null`
- `notification_at timestamptz null`
- `reminder_sent_at timestamptz null`
- `status`：`pending | completed | skipped | cancelled`
- `created_at timestamptz not null default now()`
- 唯一约束 `(plan_id, scheduled_date)`
- 索引 `(user_id, scheduled_date)`、`notification_at` 的待提醒部分索引

`checkins`

- `id uuid primary key`
- `user_id uuid not null`
- `occurrence_id uuid null`
- `checkin_date date not null`
- `completed_at timestamptz not null`
- `duration_minutes integer null`
- `activity_text text null`
- `notes text null`
- `is_backfilled boolean not null default false`
- `created_at`、`updated_at`
- `occurrence_id is not null` 时使用部分唯一约束，阻止同一实例重复打卡
- 临时打卡允许 `occurrence_id is null`

## 6. 计划与 Occurrence 规则

### 6.1 字段组合校验

- `one_time`：`start_date` 是唯一执行日，其余重复数组为空。
- `weekly`：`days_of_week` 至少一个值，其余重复数组为空。
- `monthly`：`days_of_month` 至少一个值，其余重复数组为空。
- `custom_dates`：至少一条 `plan_custom_dates`，其余重复数组为空。
- `end_date` 不得早于 `start_date`。
- 所有选定日期必须处于计划日期范围内。

前端使用 Zod 提供即时反馈；数据库约束与 RPC 再次校验，不能仅依赖前端。

### 6.2 生成规则

- 创建计划时，在同一事务中生成从今天或 `start_date` 较晚者起、未来 90 个本地日历日内的 occurrence。
- 每日后台任务后续补足滚动 90 天窗口。
- 日期展开使用用户当地日历，不使用 UTC 日期直接套周期。
- `scheduled_time` 保留用户设置；为空时，提醒计算使用当地 20:00。
- `notification_at` 在生成时按用户 IANA 时区转换为 UTC。
- `reminder_enabled=false` 时 `notification_at` 为 `null`。
- 唯一约束和 `on conflict do nothing` 保证重复执行幂等。

### 6.3 编辑、删除与时区变化

- 修改计划时锁定计划记录，在单一事务中删除今天及以后所有未完成旧实例，再按新规则生成未来 90 天。
- 已完成 occurrence 永久保留，不因修改或删除计划而消失。
- 删除计划采用软删除，并把未来未完成 occurrence 标记为 `cancelled`。
- 用户更改时区时，重算未来未完成且未发送提醒实例的 `notification_at`；计划选择的本地日期和本地时间保持不变。

## 7. 一键打卡与统计定义

点击“完成”立即调用事务型数据库函数：

1. 校验 occurrence 属于当前用户且状态允许完成。
2. 把 occurrence 状态更新为 `completed`。
3. 插入仅含必需字段的 checkin。
4. 返回当天状态和更新后的聚合统计。

成功后显示“今日打卡成功”，再提供可选的“补充记录”。实际时长、运动内容和备注全部可空。误操作可撤销；撤销会删除对应 checkin 并把 occurrence 恢复为 `pending`，但只允许本人操作。

当天无计划时可创建临时打卡。过去 7 个用户本地日期内允许补录，数据库函数校验日期范围并设置 `is_backfilled=true`。

统计定义：

- 累计打卡天数：`count(distinct checkin_date)`。
- 本月打卡天数：用户当地月份内的不同 `checkin_date` 数量。
- 计划日完成：当天所有有效 occurrence 都为 `completed`。
- 连续计划完成：只遍历截至今天的计划日；休息日跳过，最近一个未全部完成的计划日中断连续值。
- 同一天完成任意一个计划或临时打卡，就产生当天的公开打卡日期；公共读取在第二子项目实现。
- 最近 30 天打卡率：有计划的本地日期中，全部计划完成日期所占比例；没有计划日不进入分母。
- 运动分钟数只汇总用户实际填写的值，不推测缺失时长。

## 8. 页面与路由

公开认证路由：

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

首次资料路由：

- `/onboarding`

第一子项目主路由：

- `/`：今日计划、空状态、一键完成、临时打卡
- `/plans`：计划列表与月历入口
- `/plans/new`：创建计划
- `/plans/[id]`：查看、编辑、软删除计划
- `/stats`：累计、本月、连续计划完成、30 天完成率、已记录分钟数和月历
- `/me`：本人资料摘要与后续功能入口
- `/settings`：用户名以外的基础资料、身高和时区设置

最终底部导航固定为：首页、计划、动态、记录、我的。`/feed` 在第三子项目实现；开发中未完成入口不伪装成可用能力。

## 9. UI 与交互

- 中文、移动端优先、轻运动风格；绿色作为完成操作主色。
- 320px 及以上不得出现横向滚动。
- 交互控件满足触控尺寸，底部导航适配安全区。
- 首页首要操作是“✓ 完成今日运动”。
- 有多个 occurrence 时逐卡显示并分别完成。
- 成功反馈即时，补充记录不阻塞完成。
- 计划表单根据重复类型渐进展示字段，自定义日期使用多选日历。
- 无计划时显示“今天没有安排运动计划”和“临时打卡”。
- 未创建任何计划时显示“你还没有安排运动计划”和“创建第一个计划”。
- Push 权限拒绝或浏览器不支持时，计划与打卡功能仍完全可用。

## 10. 首页查询

首页通过单一 `get_today_dashboard()` RPC 或等价的单次服务端调用返回：

- 用户当地日期和展示文本
- 当天 occurrence 及完成状态
- 当天 checkin 摘要
- 累计打卡天数
- 当前连续计划完成数
- 未读通知数，第一子项目固定为零并在第三子项目接入

该接口只向当前会话用户返回自己的数据，避免首页连续发出多个独立请求。

## 11. RLS 与安全边界

第一子项目所有业务表开启 RLS：

- `profiles`：本人可完整读取和更新；公共读取不直接开放，第二子项目通过安全接口提供白名单字段。
- `profile_settings`：严格本人读取与更新。
- `workout_plans`、`plan_custom_dates`、`plan_occurrences`：严格本人访问。
- `checkins`：严格本人直接访问；公共打卡日历在第二子项目通过不含详情的安全接口提供。

所有权通过 `auth.uid()` 强制判断。事务型 `security definer` 函数固定 `search_path`、撤销不必要的 `public` 执行权限，并在函数内部再次校验调用者身份。

## 12. 错误与并发处理

- Server Actions 返回统一、可序列化的成功或字段级错误结构。
- 提交期间禁用按钮，防止重复点击；数据库唯一约束处理真正的并发重试。
- 网络失败不伪造成功，页面保留可重试状态。
- 第一版缓存基础离线壳和静态资源，但不实现离线写入队列。
- 用户错误不显示 SQL、表名或堆栈。
- 日志不记录密码、体重、私人备注、Push 密钥或完整请求载荷。

## 13. 迁移分层

实际 SQL 在实现阶段按以下顺序生成：

1. `0001_extensions_and_types.sql`：`citext`、枚举、通用更新时间函数。
2. `0002_profiles.sql`：资料、设置、首次资料 RPC、头像 Storage 策略、约束和 RLS。
3. `0003_workout_plans.sql`：计划、自定义日期、Occurrence、索引和 RLS。
4. `0004_occurrence_functions.sql`：周期展开、创建/修改/删除计划事务、时区重算。
5. `0005_checkins.sql`：打卡、撤销、补录、约束和 RLS。
6. `0006_dashboard_and_stats.sql`：首页与统计 RPC。
7. `0007_core_rls_tests.sql`：核心权限和业务规则验证。

迁移必须支持在全新 Supabase 项目中按序执行。修改已提交迁移时应新增迁移，不覆盖生产已执行历史。

## 14. 测试策略

### 14.1 单元测试

- 周、月、自定义日期展开。
- 月末、闰年、跨年与结束日期边界。
- 默认 20:00 与显式时间的 UTC 换算。
- 统计纯函数与日期展示。

### 14.2 数据库与安全测试

- 用户 A 无法读取或修改用户 B 的设置、计划、实例和打卡详情。
- 90 天生成可重复执行且不产生重复 occurrence。
- 修改计划只替换未来未完成实例，保留历史完成实例。
- 同一 occurrence 不能重复打卡。
- 同日多次打卡只增加一个累计打卡日。
- 休息日不打断连续计划完成；未完成计划日会中断。
- 补录只能覆盖过去 7 天到今天。

### 14.3 流程与响应式测试

- 注册、登录、退出、找回密码、重置密码、首次资料填写。
- 四类计划创建、编辑、删除。
- 首页空状态、单计划、多计划、临时打卡、完成、撤销、补充记录。
- 320、375、390、430px 与桌面浏览器无横向滚动。

验证报告区分静态检查、自动测试、Supabase 实际执行和浏览器人工验证。未执行的检查不会标记为通过。

## 15. 第一子项目开发任务清单

1. 初始化 Next.js、TypeScript、Tailwind、测试框架和项目规范。
2. 建立 Supabase 浏览器端与服务端客户端，会话刷新和受保护布局。
3. 编写并实际执行核心迁移与 RLS 测试。
4. 完成注册、登录、退出、找回密码、重置密码、头像上传和 onboarding。
5. 实现周期展开纯函数及测试。
6. 实现计划事务 RPC、计划列表、创建、编辑和删除。
7. 实现月历与日期详情。
8. 实现首页 dashboard RPC 和移动端首页。
9. 实现一键打卡、撤销、临时打卡、补录和可选补充记录。
10. 实现统计 RPC 和记录页。
11. 加入 manifest 与基础 Service Worker，不在本阶段发送 Push。
12. 完成 lint、类型检查、单元测试、数据库测试、关键流程与响应式验证。
13. 补充 `.env.example`、README、RLS 说明、验证报告和限制清单。

## 16. 本地与最终交付边界

当前阶段连接用户已有的 Supabase 云项目进行实际验证，不要求 Docker。Vercel 项目尚未创建，因此本阶段不能声称 Vercel 部署已验证。完整本地验证后，代码推送 GitHub；用户创建 Vercel 项目后再进行最终部署和线上 PWA 验证。

第一子项目完成标准：新用户能够注册并建立资料，不出现默认计划；能够创建四类计划并得到正确 occurrence；能够在首页一次点击完成、撤销、临时打卡和补录；能够查看正确日历与统计；核心 RLS 越权测试通过；项目可按 README 在新的 Supabase 环境复现。

## 17. 明确延后内容

以下能力不属于第一子项目，不以占位实现冒充完成：

- 公共个人主页和公开打卡接口。
- 体重记录、BMI、私人趋势和归一化公共趋势。
- 关注、动态、点赞、催促和通知中心。
- Web Push、提醒 Cron 与相关 Edge Functions。
- 进度照片、私有 Storage 和 signed URL。
- GitHub、Vercel 与生产环境最终部署验证。

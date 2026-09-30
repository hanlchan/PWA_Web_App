# CloudBase migration design

## Target

CloudBase environment `pwa-web-app-d8gpuhess695771e6` in `ap-shanghai`, using PostgreSQL mode, CloudBase Auth, PG Storage, Cloud Functions/timer triggers, and an HTTP runtime for the standalone Next.js server.

## Compatibility decisions

- Keep business user IDs as UUID. Imported CloudBase Auth users must use the original Supabase UUID as their JWT `sub`.
- Cast CloudBase's text-returning `auth.uid()` to UUID only in business-table RLS and SQL functions.
- Compare PG Storage path segments and `owner_id` directly with text `auth.uid()`.
- Remove the Supabase-specific `profiles.id -> auth.users.id` foreign key because CloudBase's internal Auth primary key is bigint and is not an application-managed schema. Ownership remains enforced by imported `sub`, RLS, and application flows.
- Keep `citext` and pgTAP. Do not migrate `pg_net`; do not use `pg_cron` for production scheduling.
- Preserve PostgreSQL/PostgREST-style RPCs and table access where CloudBase officially supports the behavior.

## Cutover

Bulk-copy schema, users, data, and storage; validate in isolation; perform a final delta migration during a controlled write freeze; enable only CloudBase timers; then switch the production origin. Vercel and Supabase remain recoverable for seven days, with Supabase production writes and old schedules disabled only at cutover.

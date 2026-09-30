# CloudBase migration requirements

## Goal

Move the production PWA from Vercel and Supabase to Tencent CloudBase in Shanghai without data loss, weaker authorization, or a big frontend rewrite.

## Safety constraints

- Migrate and validate before directing production traffic to CloudBase.
- Keep Vercel and Supabase intact as rollback systems until at least seven stable days after cutover.
- Preserve all business UUIDs, timestamps, relationships, and user ownership.
- Preserve or strengthen every RLS boundary; private weight, photo, notification, and push-subscription data must remain owner-only.
- Keep credentials out of Git, public environment variables, logs, and documentation.
- Use current CloudBase PostgreSQL, Auth, PG Storage, Functions, timer triggers, and HTTP hosting interfaces.
- Do not run duplicate Supabase and CloudBase reminder schedules against production users.

## Acceptance criteria

- The 13 current business tables and all compatible types, constraints, indexes, functions, triggers, grants, and policies exist in CloudBase PostgreSQL.
- Source and destination row counts match for every table and sampled records match.
- The two current users retain their business UUID mapping. Passwords are reset when hashes cannot be imported through an official interface.
- `avatars` and `progress-photos` retain their public/private security models and all objects migrate.
- The application builds and passes lint, typecheck, Vitest, Playwright, pgTAP, production E2E, cross-user RLS, PWA, push, cron, and mainland-China performance checks.
- Production network traces no longer depend on `vercel.app` or `supabase.co` after cutover.

## Current audited baseline

- Supabase PostgreSQL 17.6; CloudBase PostgreSQL 17.11.
- 13 public business tables, 69 total business rows, 2 Auth users, and 2 Auth identities.
- Storage buckets: public `avatars` and private `progress-photos`; both currently contain zero objects.
- Scheduled jobs: occurrence generation and workout reminders.
- No Realtime publications are used by the application.

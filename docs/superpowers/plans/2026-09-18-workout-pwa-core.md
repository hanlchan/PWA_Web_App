# Workout PWA Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deployable core loop for a Chinese, mobile-first workout PWA: email/password auth, profile onboarding, user-created recurring plans, 90-day occurrences, one-tap check-ins, calendar, and statistics.

**Architecture:** Use Next.js App Router with cookie-based Supabase SSR, Server Components for reads, Server Actions for writes, and PostgreSQL RLS plus transaction RPCs as the authorization boundary. Keep date recurrence in a tested TypeScript domain module and duplicate critical validation in SQL; public/social/weight/photo features remain outside this plan.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, `@supabase/ssr`, Zod, date-fns, Vitest, Testing Library, Playwright, pgTAP, npm.

---

## File map

Create or modify these focused units:

```text
package.json                         scripts and dependencies
.env.example                        public environment contract only
.gitignore                          secrets, build output, visual scratch files
next.config.ts                      security and service-worker headers
vitest.config.ts                    unit/component test configuration
playwright.config.ts                mobile and desktop browser projects
src/proxy.ts                        Supabase session refresh and route gate
src/app/(auth)/*                    login/register/password screens and actions
src/app/onboarding/*                required first-profile flow
src/app/(app)/layout.tsx            protected mobile application shell
src/app/(app)/page.tsx              today dashboard
src/app/(app)/plans/*               plan list/create/edit routes
src/app/(app)/stats/page.tsx        calendar and aggregate statistics
src/app/(app)/me/page.tsx           private profile summary
src/app/(app)/settings/*            profile, height, and timezone editing
src/app/auth/callback/route.ts       PKCE password recovery callback
src/app/manifest.ts                 install metadata
src/components/layout/*             bottom navigation and page shell
src/components/workout/*            occurrence card and one-tap actions
src/components/plans/*              recurrence-aware plan form
src/components/calendar/*           month grid and day details
src/components/stats/*              metric cards and completion rate
src/components/auth/*               auth form controls
src/lib/supabase/client.ts           browser Supabase client
src/lib/supabase/server.ts           cookie-scoped server client
src/lib/supabase/proxy.ts            cookie refresh helper
src/lib/validation/*                Zod schemas and normalized action errors
src/lib/recurrence/*                pure recurrence/date expansion
src/lib/images/avatar.ts             browser-side avatar re-encoding
src/lib/actions/*                    focused Server Actions
src/lib/queries/*                    typed read adapters
src/lib/types/database.ts            generated Supabase database types
src/test/*                           Vitest setup and factories
tests/e2e/*                          Playwright user flows
supabase/config.toml                 Supabase CLI project configuration
supabase/migrations/0001_*.sql       extensions, enums, helpers
supabase/migrations/0002_*.sql       profiles, settings, avatar policies
supabase/migrations/0003_*.sql       plans, custom dates, occurrences
supabase/migrations/0004_*.sql       occurrence transaction functions
supabase/migrations/0005_*.sql       check-ins and transaction functions
supabase/migrations/0006_*.sql       dashboard and statistics RPCs
supabase/tests/database/*.sql        pgTAP schema, RLS, and behavior tests
public/sw.js                         offline shell and future push hooks
public/icons/*                       PWA icons
docs/security/rls.md                 policy and RPC threat model
docs/verification/core.md            executed checks and honest status
README.md                            local, Supabase, and deployment setup
```

## Task 1: Bootstrap the repository and quality gates

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `.gitignore`, `.env.example`, `vitest.config.ts`, `src/test/setup.ts`, `playwright.config.ts`

- [ ] **Step 1: Create the npm manifest and install the runtime packages**

Create `package.json` with scripts before installing packages:

```json
{
  "name": "friend-workout-pwa",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:lint": "supabase db lint --linked --level error",
    "db:test": "supabase test db --linked"
  }
}
```

Run:

```powershell
npm install next@latest react@latest react-dom@latest @supabase/ssr @supabase/supabase-js zod date-fns @date-fns/tz lucide-react clsx tailwind-merge sonner
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss eslint eslint-config-next vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test supabase
```

Expected: `package-lock.json` is created and `npm ls --depth=0` exits 0.

- [ ] **Step 2: Add strict TypeScript, Tailwind, ESLint, and test configuration**

Use `strict: true`, `noUncheckedIndexedAccess: true`, the `@/* -> ./src/*` alias, jsdom for Vitest, and Chromium projects for desktop plus 320/375/390/430px mobile viewports. `src/test/setup.ts` must import `@testing-library/jest-dom/vitest`.

Run: `npm run typecheck`

Expected: FAIL because the initial application files do not exist yet.

- [ ] **Step 3: Add the minimal root application**

`src/app/layout.tsx` must set `lang="zh-CN"`, viewport safe-area support, and global metadata. `src/app/page.tsx` temporarily redirects to `/login`; later tasks replace it with the protected dashboard.

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}
```

- [ ] **Step 4: Protect secrets and scratch output**

`.gitignore` must include:

```gitignore
node_modules/
.next/
coverage/
playwright-report/
test-results/
.env*
!.env.example
.superpowers/
```

`.env.example` must contain only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 5: Verify and commit**

Run: `npm run lint; npm run typecheck; npm test`

Expected: all exit 0 with no tests collected or only the setup smoke test passing.

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts playwright.config.ts src .gitignore .env.example
git commit -m "chore: bootstrap workout PWA"
```

## Task 2: Add Supabase SSR session plumbing

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Test: `src/lib/env.test.ts`, `src/lib/supabase/proxy.test.ts`

- [ ] **Step 1: Write environment validation tests**

```ts
import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './env'

describe('parsePublicEnv', () => {
  it('rejects missing or non-URL Supabase values', () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' })).toThrow()
  })
})
```

Run: `npm test -- src/lib/env.test.ts`

Expected: FAIL because `parsePublicEnv` does not exist.

- [ ] **Step 2: Implement public environment validation**

Create a Zod object that accepts exactly the three variables in `.env.example`, exports `publicEnv`, and never references a service-role variable.

```ts
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
})
```

- [ ] **Step 3: Implement browser and server clients**

Use `createBrowserClient` in `client.ts` and `createServerClient` plus `await cookies()` in `server.ts`. Expose only `createClient()` from each module and type both with `Database` from `src/lib/types/database.ts`.

- [ ] **Step 4: Implement current Next.js Proxy session refresh**

`src/lib/supabase/proxy.ts` must create a request-scoped Supabase client, call `auth.getUser()`, copy every refreshed cookie to the response, and redirect unauthenticated requests from `/`, `/plans`, `/stats`, `/me`, `/settings`, and `/onboarding` to `/login`.

`src/proxy.ts` delegates to that helper and excludes static assets through its matcher. Do not authorize from `getSession()` alone.

- [ ] **Step 5: Test redirect and cookie propagation**

Mock `auth.getUser()` for anonymous and signed-in cases. Assert anonymous protected routes redirect and signed-in responses preserve all returned `Set-Cookie` values.

Run: `npm test -- src/lib/env.test.ts src/lib/supabase/proxy.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/env.ts src/lib/env.test.ts src/lib/supabase src/proxy.ts src/lib/types/database.ts
git commit -m "feat: add Supabase SSR session plumbing"
```

## Task 3: Create profiles, settings, avatar storage, and RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/0001_extensions_and_types.sql`
- Create: `supabase/migrations/0002_profiles.sql`
- Test: `supabase/tests/database/001_profiles_schema.test.sql`, `002_profiles_rls.test.sql`

- [ ] **Step 1: Initialize Supabase project files**

Run: `npx supabase init`

Expected: `supabase/config.toml` exists. Do not run `supabase start`; this project uses the existing hosted Supabase instance for actual verification.

- [ ] **Step 2: Write failing pgTAP schema assertions**

The test must begin a transaction, call `plan(12)`, assert `profiles` and `profile_settings` exist, assert RLS is enabled, and assert the username, timezone, height, and privacy-default columns and constraints exist. Finish and roll back.

Run: `npx supabase test db --linked supabase/tests/database/001_profiles_schema.test.sql`

Expected: FAIL because the migration has not been applied.

- [ ] **Step 3: Create extensions, enums, and helper functions**

`0001_extensions_and_types.sql` must enable `citext`, define the recurrence/occurrence enums used by later migrations, create a `set_updated_at()` trigger function, and revoke public execution from internal helper functions.

- [ ] **Step 4: Create profile tables and constraints**

`0002_profiles.sql` must create both tables exactly as specified, including this username rule:

```sql
constraint profiles_username_format check (
  username::text ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$'
)
```

Add `height_cm between 50 and 300`, validate `timezone` through `pg_timezone_names`, default all privacy switches to their safe values, and attach update triggers.

- [ ] **Step 5: Add onboarding RPC and RLS**

Create `complete_onboarding(p_username citext, p_display_name text, p_height_cm numeric, p_timezone text, p_avatar_path text)` as `security invoker`. It inserts `profiles` and `profile_settings` for `auth.uid()` in one transaction and returns the profile ID. Policies allow direct select/update only where `id = auth.uid()` or `user_id = auth.uid()`.

- [ ] **Step 6: Create avatar bucket and Storage policies**

Insert an `avatars` bucket with `public=true`, 5MB limit, and `image/jpeg,image/png,image/webp`. Storage insert/update/delete policies require the first folder segment to equal `auth.uid()::text`; public reads are allowed because avatars are public profile data.

- [ ] **Step 7: Verify against the linked Supabase project**

Run:

```powershell
$env:SUPABASE_PROJECT_REF = '由用户从 Supabase Dashboard 提供的项目 ref'
npx supabase link --project-ref $env:SUPABASE_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase db lint --linked --level error
npx supabase test db --linked
```

Expected: dry run lists `0001` and `0002`; push succeeds; lint has no errors; pgTAP passes. Record the exact output in `docs/verification/core.md`, with secrets omitted.

- [ ] **Step 8: Generate types and commit**

Run: `npx supabase gen types typescript --linked > src/lib/types/database.ts`

Expected: generated types contain `profiles`, `profile_settings`, and `complete_onboarding`.

```powershell
git add supabase src/lib/types/database.ts
git commit -m "feat: add profile schema and RLS"
```

## Task 4: Implement auth, password recovery, onboarding, and avatar processing

**Files:**
- Create: `src/lib/validation/auth.ts`, `src/lib/validation/profile.ts`, `src/lib/actions/auth.ts`, `src/lib/actions/profile.ts`
- Create: `src/lib/images/avatar.ts`
- Create: `src/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`
- Create: `src/app/auth/callback/route.ts`, `src/app/onboarding/page.tsx`
- Create: `src/components/auth/auth-form.tsx`, `src/components/auth/password-field.tsx`
- Test: adjacent `*.test.ts` / `*.test.tsx` files and `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write failing schema tests**

Test normalized lowercase usernames, invalid underscores, password minimum length, display-name length, height bounds, and valid IANA timezones.

```ts
expect(profileSchema.parse({ username: 'Han_Chan', displayName: '韩', timezone: 'Asia/Shanghai' }).username)
  .toBe('han_chan')
expect(() => profileSchema.parse({ username: '_bad', displayName: '韩', timezone: 'bad' })).toThrow()
```

- [ ] **Step 2: Implement schemas and normalized action results**

All auth/profile actions return:

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
```

Map duplicate username errors to “用户名已被使用” without returning SQL details.

- [ ] **Step 3: Implement auth actions**

Use `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, and `updateUser`. Password reset uses `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`; the callback exchanges the PKCE code and validates `next` against an internal allowlist.

- [ ] **Step 4: Implement avatar re-encoding**

`prepareAvatar(file)` must reject unsupported MIME types or files over 5MB, decode into an `ImageBitmap`, draw to a maximum 512×512 canvas, and export WebP. This re-encoding removes EXIF metadata.

- [ ] **Step 5: Implement onboarding transaction flow**

Upload the prepared avatar to `avatars/{userId}/avatar-{crypto.randomUUID()}.webp`, call `complete_onboarding`, remove the new object if the RPC fails, then redirect to `/`. If no avatar is supplied, skip Storage entirely.

- [ ] **Step 6: Build accessible Chinese auth and onboarding screens**

Forms must have labels, autocomplete attributes, visible field errors, pending button states, and no email rendered outside the private account form. The onboarding page defaults timezone with `Intl.DateTimeFormat().resolvedOptions().timeZone` and never creates a plan.

- [ ] **Step 7: Add component and Playwright coverage**

Test that pending submit disables buttons, validation errors remain visible, onboarding renders no plan suggestions, and successful onboarding lands on the exact empty-state copy.

Run: `npm test; npm run test:e2e -- tests/e2e/auth.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/app src/components/auth src/lib/actions src/lib/validation src/lib/images tests/e2e/auth.spec.ts
git commit -m "feat: add authentication and onboarding"
```

## Task 5: Build and test the recurrence domain

**Files:**
- Create: `src/lib/recurrence/types.ts`, `expand.ts`, `notification.ts`, `index.ts`
- Test: `src/lib/recurrence/expand.test.ts`, `notification.test.ts`

- [ ] **Step 1: Define domain types and failing recurrence cases**

```ts
export type RecurrenceRule =
  | { type: 'one_time'; startDate: string; endDate?: string }
  | { type: 'weekly'; startDate: string; endDate?: string; daysOfWeek: number[] }
  | { type: 'monthly'; startDate: string; endDate?: string; daysOfMonth: number[] }
  | { type: 'custom_dates'; startDate: string; endDate?: string; customDates: string[] }
```

Tests must cover Monday/Wednesday/Friday, day 31 skipping short months, leap day, end-date inclusivity, duplicate custom dates, and a 90-day horizon.

- [ ] **Step 2: Run the tests to prove failure**

Run: `npm test -- src/lib/recurrence`

Expected: FAIL because `expandRecurrence` and `toNotificationUtc` do not exist.

- [ ] **Step 3: Implement deterministic local-date expansion**

Export `expandRecurrence(rule, windowStart, windowEnd): string[]`. Parse ISO dates as calendar values rather than JavaScript UTC timestamps, deduplicate, sort ascending, and clip to the intersection of rule and window boundaries.

- [ ] **Step 4: Implement notification conversion**

Export `toNotificationUtc({ scheduledDate, scheduledTime, timezone, reminderEnabled })`. Return `null` when reminders are disabled, otherwise use `scheduledTime ?? '20:00:00'` and reject DST-invalid local times with a typed error rather than silently changing the selected wall time.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/lib/recurrence; npm run typecheck`

Expected: all recurrence tests pass and TypeScript exits 0.

```powershell
git add src/lib/recurrence
git commit -m "feat: add recurrence domain"
```

## Task 6: Add plan, custom-date, occurrence schema and transaction RPCs

**Files:**
- Create: `supabase/migrations/0003_workout_plans.sql`
- Create: `supabase/migrations/0004_occurrence_functions.sql`
- Test: `supabase/tests/database/003_plan_schema.test.sql`, `004_occurrence_generation.test.sql`

- [ ] **Step 1: Write failing schema and behavior tests**

Assert all columns, enums, foreign keys, RLS, `(plan_id, scheduled_date)` uniqueness, `(user_id, scheduled_date)` index, and notification partial index. Behavior cases must cover all four recurrence types, monthly day 31, disabled reminders, default 20:00, explicit start time, idempotent reruns, and ownership rejection.

- [ ] **Step 2: Create plan tables and database invariants**

Use check constraints that enforce exactly one recurrence payload shape. Add `deleted_at`, retain plan references for historical occurrences, and prevent `end_date < start_date`.

- [ ] **Step 3: Implement SQL occurrence expansion**

Create private `expand_plan_dates(p_plan_id uuid, p_from date, p_to date) returns setof date`. Use `generate_series` for weekly/monthly rules, exact custom dates for custom rules, and the plan owner's timezone for `notification_at`.

- [ ] **Step 4: Implement atomic plan RPCs**

Create `create_workout_plan(jsonb)`, `update_workout_plan(uuid,jsonb)`, and `delete_workout_plan(uuid)`. Each function must derive the owner from `auth.uid()`, validate input, synchronize custom dates, generate the rolling 90-day window, preserve completed history, and return the plan ID. Fix `search_path`, revoke public execution, and grant only to `authenticated`.

- [ ] **Step 5: Implement timezone rescheduling function**

`reschedule_future_notifications(p_user_id uuid)` updates only pending, future, unsent occurrences and applies local 20:00 when `scheduled_time` is null.

- [ ] **Step 6: Push, test, regenerate types, and commit**

Run: `npx supabase db push; npx supabase db lint --linked --level error; npx supabase test db --linked`

Expected: migrations apply once, lint passes, every plan test passes on repeat execution.

```powershell
npx supabase gen types typescript --linked > src/lib/types/database.ts
git add supabase src/lib/types/database.ts
git commit -m "feat: add workout plans and occurrence generation"
```

## Task 7: Build plan list, form, create, edit, and delete flows

**Files:**
- Create: `src/lib/validation/plan.ts`, `src/lib/actions/plans.ts`, `src/lib/queries/plans.ts`
- Create: `src/components/plans/plan-form.tsx`, `recurrence-fields.tsx`, `custom-date-picker.tsx`, `plan-card.tsx`
- Create: `src/app/(app)/plans/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- Test: adjacent unit/component tests and `tests/e2e/plans.spec.ts`

- [ ] **Step 1: Write failing validation tests**

Test each recurrence discriminant, missing weekly days, day-of-month bounds, custom-date deduplication, end-before-start, duration bounds, title trimming, and absence of any URL field.

- [ ] **Step 2: Implement the discriminated Zod schema**

Unknown keys must be stripped or rejected. The parsed action payload may contain `title`, `description`, `durationMinutes`, recurrence fields, `startTime`, `reminderEnabled`, and `notes`; it must not accept `externalUrl`, `video`, or `url`.

- [ ] **Step 3: Implement query and action adapters**

`listPlans`, `getPlan`, `createPlanAction`, `updatePlanAction`, and `deletePlanAction` must use the caller-scoped server client. Actions call RPCs, normalize errors, revalidate `/`, `/plans`, and `/stats`, then redirect only after success.

- [ ] **Step 4: Build the progressive plan form**

Render only fields relevant to the selected recurrence. Weekly uses seven Chinese weekday toggles; monthly supports 1–31; custom dates use a keyboard-accessible multi-select calendar. Keep reminders independent from browser notification permission.

- [ ] **Step 5: Build list and detail routes**

The plan list shows active user-created plans only. The detail page supports editing and an explicit destructive confirmation for soft deletion. No page displays sample/default plans or video links.

- [ ] **Step 6: Verify user flows**

Run: `npm test -- src/lib/validation/plan.test.ts src/components/plans; npm run test:e2e -- tests/e2e/plans.spec.ts`

Expected: all four recurrence flows pass; mobile viewport has no horizontal overflow.

- [ ] **Step 7: Commit**

```powershell
git add src/app src/components/plans src/lib/actions/plans.ts src/lib/queries/plans.ts src/lib/validation/plan.ts tests/e2e/plans.spec.ts
git commit -m "feat: add workout plan management"
```

## Task 8: Add check-in, undo, backfill, and detail RPCs

**Files:**
- Create: `supabase/migrations/0005_checkins.sql`
- Test: `supabase/tests/database/005_checkins.test.sql`, `006_checkins_rls.test.sql`

- [ ] **Step 1: Write failing pgTAP check-in cases**

Cover one-tap completion with all optional values null, one check-in per occurrence, multiple same-day check-ins counting once, temporary check-ins, seven-day backfill bounds, undo ownership, occurrence status restoration, and user A blocked from user B details.

- [ ] **Step 2: Create table, indexes, and RLS**

Create the specified columns, duration bounds, a partial unique index on non-null `occurrence_id`, `(user_id, checkin_date)` index, and owner-only policies.

- [ ] **Step 3: Implement transactional RPCs**

Create:

```sql
complete_occurrence(p_occurrence_id uuid) returns uuid
create_manual_checkin(p_checkin_date date, p_is_backfilled boolean) returns uuid
update_checkin_details(p_checkin_id uuid, p_duration_minutes integer, p_activity_text text, p_notes text) returns void
undo_checkin(p_checkin_id uuid) returns void
```

Each RPC derives the user from `auth.uid()`, locks relevant rows, validates local-date rules using the profile timezone, and never accepts a caller-supplied user ID.

- [ ] **Step 4: Push, test, regenerate types, and commit**

Run: `npx supabase db push; npx supabase test db --linked`

Expected: all check-in and RLS tests pass, including repeat requests.

```powershell
npx supabase gen types typescript --linked > src/lib/types/database.ts
git add supabase src/lib/types/database.ts
git commit -m "feat: add secure check-in transactions"
```

## Task 9: Implement the dashboard and one-tap interaction

**Files:**
- Create: `supabase/migrations/0006_dashboard_and_stats.sql`
- Create: `src/lib/queries/dashboard.ts`, `src/lib/actions/checkins.ts`
- Create: `src/components/workout/occurrence-card.tsx`, `checkin-feedback.tsx`, `checkin-details-form.tsx`, `manual-checkin-button.tsx`
- Delete: `src/app/page.tsx`
- Create: `src/app/(app)/page.tsx`
- Test: component tests, `tests/e2e/dashboard.spec.ts`, `supabase/tests/database/007_dashboard.test.sql`

- [ ] **Step 1: Write failing dashboard RPC assertions**

Seed no-plan, one-plan, multi-plan, partially completed, and completed days. Assert one response contains local date, occurrences, today's safe check-in summaries, total distinct days, current planned-day streak, and unread count zero.

- [ ] **Step 2: Implement `get_today_dashboard()`**

Return a typed JSON object for `auth.uid()` only. Calculate the streak over planned local dates, requiring all non-cancelled occurrences on a day to be completed and skipping rest days. Do not include private notes in occurrence summaries.

- [ ] **Step 3: Write failing one-tap component tests**

Assert submit happens without extra fields, button disables while pending, success text is “今日打卡成功”, optional details appear only afterward, and failure restores the action.

- [ ] **Step 4: Build the dashboard components and actions**

Render the exact empty states, one card per occurrence, prominent green completion action, and manual check-in when no plans exist that day. Use `useActionState` or an equivalent typed pending pattern; do not claim success before the action resolves.

- [ ] **Step 5: Add undo and optional details**

After completion show a reversible toast and “补充记录”. Undo calls the RPC and refreshes dashboard data. Details accept blank values and never infer duration.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/components/workout; npm run test:e2e -- tests/e2e/dashboard.spec.ts; npx supabase test db --linked`

Expected: PASS for empty, one, many, complete, undo, manual, and failure states.

```powershell
git add supabase src/app src/components/workout src/lib/actions/checkins.ts src/lib/queries/dashboard.ts tests/e2e/dashboard.spec.ts
git commit -m "feat: add one-tap workout dashboard"
```

## Task 10: Build calendar, day details, and statistics

**Files:**
- Create: `src/lib/queries/calendar.ts`, `src/lib/queries/stats.ts`
- Create: `src/components/calendar/month-calendar.tsx`, `day-cell.tsx`, `day-details.tsx`
- Create: `src/components/stats/metric-card.tsx`, `completion-rate.tsx`
- Create: `src/app/(app)/stats/page.tsx`, `src/app/(app)/stats/[date]/page.tsx`
- Test: adjacent tests and `tests/e2e/stats.spec.ts`

- [ ] **Step 1: Write failing statistics tests**

Cover distinct check-in days, current month in the user's timezone, all-occurrences completion per planned day, rest-day skipping, missed-day interruption, 30-day denominator rules, and summing only non-null actual minutes.

- [ ] **Step 2: Complete SQL statistics functions**

Add `get_user_stats(p_month date)` and `get_calendar_month(p_month date)`. Both derive the caller from `auth.uid()` and return only the caller's data. Calendar states are `planned_pending`, `planned_completed`, `manual_completed`, and `future_planned`.

- [ ] **Step 3: Build accessible calendar components**

Use a semantic grid with Chinese weekday headers, visible legend, non-color status cues, keyboard focus, and links to date details. The date page lists occurrences and check-ins and permits backfill only within the database-enforced seven-day window.

- [ ] **Step 4: Build metric cards**

Show total days, current month, consecutive planned days, 30-day completion rate, and recorded minutes. Render “暂无记录” rather than zero-invented minutes when all durations are null.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/components/calendar src/components/stats; npm run test:e2e -- tests/e2e/stats.spec.ts`

Expected: calendar and all statistical boundary cases pass.

```powershell
git add src/app src/components/calendar src/components/stats src/lib/queries tests/e2e/stats.spec.ts supabase
git commit -m "feat: add calendar and workout statistics"
```

## Task 11: Add the mobile shell, settings, and profile summary

**Files:**
- Create: `src/components/layout/app-shell.tsx`, `bottom-nav.tsx`, `page-header.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/me/page.tsx`, `src/app/(app)/settings/page.tsx`
- Test: `src/components/layout/bottom-nav.test.tsx`, `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Write failing navigation and viewport tests**

Assert five Chinese navigation labels, active state, touch targets at least 44px, safe-area padding, and no horizontal overflow at 320/375/390/430px. `/feed` must be visibly unavailable until its own subproject rather than presenting fake content.

- [ ] **Step 2: Implement the protected application shell**

Server layout verifies `auth.getUser()`, checks profile existence, redirects incomplete users to `/onboarding`, and renders a centered mobile canvas with desktop breathing room and fixed bottom navigation.

- [ ] **Step 3: Implement private profile and settings pages**

`/me` shows avatar, display name, username, and private shortcuts. `/settings` updates display name, optional height, avatar, and timezone. A timezone change calls the database rescheduling function in the same successful flow.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/components/layout; npm run test:e2e -- tests/e2e/responsive.spec.ts`

Expected: PASS at every required viewport with `document.documentElement.scrollWidth <= innerWidth`.

```powershell
git add src/app src/components/layout tests/e2e/responsive.spec.ts
git commit -m "feat: add mobile app shell and settings"
```

## Task 12: Add installable PWA shell and security headers

**Files:**
- Create: `src/app/manifest.ts`, `src/app/offline/page.tsx`, `src/components/pwa/service-worker-registration.tsx`
- Create: `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
- Modify: `src/app/layout.tsx`, `next.config.ts`
- Test: `tests/e2e/pwa.spec.ts`

- [ ] **Step 1: Write failing manifest and offline-shell checks**

Assert manifest name, short name, standalone display, theme/background colors, and required icons. Assert `/sw.js` returns JavaScript with `Cache-Control: no-cache, no-store, must-revalidate`.

- [ ] **Step 2: Implement manifest and registration**

Use `MetadataRoute.Manifest`. Register `/sw.js` only in production-capable browsers and never request notification permission in this task.

- [ ] **Step 3: Implement a conservative service worker**

Cache only versioned same-origin static assets and an offline fallback. Use network-first for navigations and never cache authenticated Supabase responses, Server Action responses, or private HTML. Include inert `push` and `notificationclick` handlers that become active only when the notification subproject supplies validated payloads.

- [ ] **Step 4: Add security headers**

Configure `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and the service-worker content type/cache/CSP headers. Keep CSP compatible with Next.js and Supabase HTTPS/WebSocket origins.

- [ ] **Step 5: Run Lighthouse-style and browser verification**

Run: `npm run build; npm run test:e2e -- tests/e2e/pwa.spec.ts`

Expected: build succeeds; manifest is installable; basic offline page opens; authenticated data is absent from Cache Storage.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/components/pwa public next.config.ts tests/e2e/pwa.spec.ts
git commit -m "feat: add secure PWA shell"
```

## Task 13: Finish database security tests and project documentation

**Files:**
- Create: `supabase/tests/database/008_cross_user_rls.test.sql`, `009_core_regressions.test.sql`
- Create: `docs/security/rls.md`, `docs/verification/core.md`, `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add cross-user test identities**

In transaction-scoped pgTAP setup, create users A and B, set JWT claims for each role, and prove A cannot select/update/delete B's profile settings, plans, occurrences, or check-in details. Prove RPCs reject caller-supplied or foreign identifiers.

- [ ] **Step 2: Add core regression cases**

Assert no profile trigger creates a workout plan; multiple same-day check-ins count once; rest days do not break streaks; a missed planned day does; completed occurrences survive plan edits/deletion; default and explicit notification times are correct; disabled reminders produce null notification time.

- [ ] **Step 3: Run the complete verification matrix**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npx supabase db lint --linked --level error
npx supabase test db --linked
git diff --check
```

Expected: every command exits 0. If hosted pgTAP cannot run safely, use a dedicated Supabase test branch/project; do not run destructive fixtures against production data.

- [ ] **Step 4: Write the RLS document**

Document each table, direct role access, owner predicate, RPC grants, fixed `search_path`, avatar Storage policy, and explicit proof that service-role credentials are absent from the browser bundle.

- [ ] **Step 5: Write the README**

Include Node/npm prerequisites, dependency installation, `.env.local`, disabling email confirmation for the chosen flow, linking Supabase, dry-running and applying migrations, avatar bucket creation by migration, generated types, local run, tests, PWA HTTPS check, GitHub push, later Vercel configuration, and rollback guidance. State that Vercel is not yet verified.

- [ ] **Step 6: Record verification truthfully**

`docs/verification/core.md` must list command, date, environment, result, and evidence summary. Separate static checks, automated tests, hosted Supabase execution, browser checks, and unperformed Vercel deployment.

- [ ] **Step 7: Commit the verified core**

```powershell
git add supabase/tests docs README.md .env.example
git commit -m "docs: add core security and verification guide"
git status --short --branch
```

Expected: only intentional local-only files are untracked; `.env.local` and `.superpowers/` are ignored.

## Execution checkpoints

- After Task 2: request only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`; never request a Secret Key or service-role key in chat.
- Before Task 3 linked execution: obtain the Supabase project ref and confirm the project contains no production data that test fixtures could affect.
- After Task 6: manually inspect generated occurrences for all four recurrence types and two timezones.
- After Task 9: manually verify one-tap completion on a 320px viewport.
- After Task 13: provide an explicit completed/limited/unverified list before beginning the second subproject.

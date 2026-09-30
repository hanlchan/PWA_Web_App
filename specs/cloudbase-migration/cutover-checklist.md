# CloudBase cutover checklist

Target environment: `pwa-web-app-d8gpuhess695771e6` (`ap-shanghai`). This is a gated procedure, not an instruction to switch traffic before the checks pass.

## Before the maintenance window

0. Bind a production custom domain to the CloudBase HTTP gateway and verify HTTPS, Auth callback URLs, security-domain allowlist, PWA scope, and new-Origin Push registration. The default `*.tcloudbaseapp.com` test domain is not a production endpoint under the [current CloudBase policy](https://docs.cloudbase.net/service/alias); without a domain, stop before cutover.
1. Disposable-account shadow browser flows (login, onboarding, avatar upload/display, plan create/edit/delete, check-in/undo, records, weight/BMI, private progress-photo upload/display, public/private visibility, photo delete, logout) passed on 2026-09-28. A second two-account flow verified authenticated cross-user app privacy, follow/unfollow, like/unlike, and notification separation. Both test accounts and their generated images/rows were removed; all 13 business tables and `storage.objects` matched the pretest 75-row baseline. Finish nudge, session-refresh, real Web Push receipt, and mainland performance checks on the intended production Origin. Previously issued signed photo URLs have a short expiry and are not proven instantly revocable on visibility changes.
2. Confirm both Auth UUID mappings, login/reset status, 13 business tables, RLS, 14 pgTAP files / 137 assertions, Storage object inventory, and function/gateway health. Reconfirm the `extensions` schema USAGE grant for `authenticated` and no grant for `anon` after the new migration. Keep the `noodle` account and all owned data even if its password reset is deferred.
3. Capture fresh Supabase and CloudBase per-table counts and canonical hashes. The last verified 2026-09-27 snapshot matched at 75/75 business rows after an atomic one-reminder reconciliation. This is not a cutover snapshot: old cron is still active, so re-export and reconcile any newer delta.
4. Record existing Supabase cron jobs and verify CloudBase Timer Trigger lists are still empty. Confirm CloudBase's seven-field schedule timezone before translating the source schedules (`* * * * *` and `15 2 * * *`).
5. Take recoverable database and Storage backups. Record Vercel deployment and CloudBase function version or package identity for rollback. Do not delete any existing data.

## Maintenance window

1. Put the old production app into a controlled write freeze and verify new Supabase business writes have stopped. Keep the old read path available for rollback.
2. Re-export every source business table and Storage object manifest. Compare with a fresh CloudBase snapshot. Investigate target-only rows and conflicts individually; never truncate or replace the target wholesale.
   The existing `.migration-work/incremental-sync.sql` predates the latest source export and must not be executed as-is.
3. Apply only the reconciled delta, preserving UUIDs, timestamps, relationships, and target-only data. Recompute per-table counts and hashes, inspect representative records, and rerun RLS/pgTAP.
4. Disable both Supabase cron jobs and verify neither will fire again. Only then create CloudBase Timer Triggers for `generate-occurrences` and `send-workout-reminders`. Run one controlled invocation and check logs, notification uniqueness, and Push delivery.
5. Switch the approved production Origin to CloudBase. Verify SSR, login/session, plans, check-ins, private photos, notifications, Push, PWA/offline behavior, and network requests from mainland China. Confirm production no longer calls Vercel or Supabase.

## Seven-day observation and rollback

Keep Vercel and Supabase recoverable for seven days. Monitor CloudBase Auth, counts, Storage, RLS, function logs, timers, Push, error rate, and latency. During rollback, first stop CloudBase timers, then restore the old write path and Supabase schedules in a controlled order; reconcile any CloudBase-only writes before reverting traffic.

After seven stable days, take final Supabase database and Storage exports and retain offline backups before pausing the old project. Do not permanently delete Supabase data as part of cutover.

begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(12);
select has_table('public', 'workout_plans', 'plans table exists');
select has_table('public', 'plan_custom_dates', 'custom dates table exists');
select has_table('public', 'plan_occurrences', 'occurrences table exists');
select has_column('public', 'workout_plans', 'recurrence_type', 'recurrence type exists');
select has_column('public', 'workout_plans', 'days_of_week', 'weekly payload exists');
select has_column('public', 'workout_plans', 'days_of_month', 'monthly payload exists');
select has_column('public', 'plan_occurrences', 'notification_at', 'notification timestamp exists');
select has_column('public', 'plan_occurrences', 'reminder_sent_at', 'reminder sent timestamp exists');
select has_index('public', 'plan_occurrences', 'plan_occurrences_plan_date_key', 'plan/date is unique');
select has_index('public', 'plan_occurrences', 'plan_occurrences_user_date_idx', 'dashboard index exists');
select ok((select relrowsecurity from pg_class where oid = 'public.workout_plans'::regclass), 'plans RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.plan_occurrences'::regclass), 'occurrences RLS enabled');
do $cloudbase_pgtap$
declare failure_summary text;
begin
  select string_agg(result, E'\n') into failure_summary from finish() as finished(result);
  if failure_summary is not null then
    raise exception 'pgTAP failed:%', E'\n' || failure_summary;
  end if;
end
$cloudbase_pgtap$;
rollback;

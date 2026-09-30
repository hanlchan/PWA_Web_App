begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(4);

-- CloudBase: auth.users is platform-owned; RLS identity is injected via request.jwt.claim.sub.
insert into public.profiles (id, username, display_name) values ('91000000-0000-0000-0000-000000000001', 'date_window', 'Date Window');
insert into public.profile_settings (user_id, timezone) values ('91000000-0000-0000-0000-000000000001', 'UTC');
insert into public.workout_plans (id, user_id, title, recurrence_type, start_date) values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Today', 'one_time', current_date),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Old', 'one_time', current_date - 8),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'Future', 'one_time', current_date + 1),
  ('92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', 'Boundary', 'one_time', current_date - 7);
insert into public.plan_occurrences (id, plan_id, user_id, scheduled_date) values
  ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', current_date),
  ('93000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', current_date - 8),
  ('93000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', current_date + 1),
  ('93000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', current_date - 7);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok('select public.complete_occurrence(''93000000-0000-0000-0000-000000000001'')', 'today can be completed');
select lives_ok('select public.complete_occurrence(''93000000-0000-0000-0000-000000000004'')', 'the seventh previous date is accepted');
select throws_ok('select public.complete_occurrence(''93000000-0000-0000-0000-000000000002'')', '22023', 'date outside backfill window', 'older than seven days is rejected');
select throws_ok('select public.complete_occurrence(''93000000-0000-0000-0000-000000000003'')', '22023', 'date outside backfill window', 'future occurrence is rejected');

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

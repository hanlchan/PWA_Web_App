begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated; select plan(8);
select has_table('public','checkins','checkins exists');
select has_index('public','checkins','checkins_occurrence_unique','occurrence check-in is unique');
select has_index('public','checkins','checkins_user_date_idx','user/date index exists');
select ok((select relrowsecurity from pg_class where oid='public.checkins'::regclass),'checkins RLS enabled');
select has_function('public','complete_occurrence',array['uuid'],'complete function exists');
select has_function('public','create_manual_checkin',array['date','boolean'],'manual function exists');
select has_function('public','undo_checkin',array['uuid'],'undo function exists');
select has_function('public','get_today_dashboard',array[]::text[],'dashboard function exists');
do $cloudbase_pgtap$
declare failure_summary text;
begin
  select string_agg(result, E'\n') into failure_summary from finish() as finished(result);
  if failure_summary is not null then
    raise exception 'pgTAP failed:%', E'\n' || failure_summary;
  end if;
end
$cloudbase_pgtap$; rollback;

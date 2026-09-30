begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(4);

select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'service role can inspect profiles for backend jobs');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'SELECT'), 'reminder job can read push subscriptions');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'DELETE'), 'reminder job can remove expired subscriptions');
select ok(has_table_privilege('service_role', 'public.notifications', 'INSERT'), 'reminder job can create in-app notifications');

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

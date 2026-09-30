begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(4);

select has_function('public', 'get_public_user_profile', array['text', 'date'], 'public profile RPC exists');
select function_privs_are('public', 'get_public_user_profile', array['text', 'date'], 'anon', array['EXECUTE'], 'anonymous visitors can read safe public profiles');
select function_privs_are('public', 'get_public_user_profile', array['text', 'date'], 'authenticated', array['EXECUTE'], 'signed-in visitors can read safe public profiles');
select ok(
  position('weight' in lower(obj_description('public.get_public_user_profile(text,date)'::regprocedure, 'pg_proc'))) > 0,
  'function documents the private fields it excludes'
);

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

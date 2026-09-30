begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(10);
select has_table('public','push_subscriptions','push subscriptions exist');
select ok((select relrowsecurity from pg_class where oid='public.push_subscriptions'::regclass),'push subscriptions RLS enabled');
select policies_are('public','push_subscriptions',array['push_subscriptions_owner_all'],'push subscriptions are owner-only');
select has_index('public','push_subscriptions','push_subscriptions_user_id_endpoint_key','subscription endpoint is unique per user');
select has_function('public','save_push_subscription',array['text','text','text','text'],'save subscription RPC exists');
select has_function('public','remove_push_subscription',array['text'],'remove subscription RPC exists');
select has_function('public','generate_all_occurrences',array[]::text[],'occurrence refill job exists');
select has_function('public','claim_due_reminders',array['integer'],'atomic reminder claim exists');
select function_privs_are('public','claim_due_reminders',array['integer'],'authenticated',array[]::text[],'users cannot claim reminder jobs');
select function_privs_are('public','claim_due_reminders',array['integer'],'service_role',array['EXECUTE'],'only service role can claim reminder jobs');
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

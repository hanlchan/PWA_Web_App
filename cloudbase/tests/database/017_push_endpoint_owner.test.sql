begin;
set local search_path = public, extensions, pg_catalog;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select plan(12);

insert into public.profiles (id, username, display_name)
values
  ('a0000000-0000-0000-0000-000000000001', 'push_owner_a', 'A'),
  ('a0000000-0000-0000-0000-000000000002', 'push_owner_b', 'B');
insert into public.profile_settings (user_id, timezone)
values
  ('a0000000-0000-0000-0000-000000000001', 'Asia/Shanghai'),
  ('a0000000-0000-0000-0000-000000000002', 'Asia/Shanghai');

select ok((select indisunique from pg_index where indexrelid = 'public.push_subscriptions_endpoint_key'::regclass),'endpoint has one owner globally');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.save_push_subscription('https://push.example.test/endpoint-one', repeat('p', 24), repeat('a', 12), 'test A');
select results_eq('select count(*)::bigint from public.push_subscriptions', array[1::bigint], 'A sees its subscription');
select results_eq('select push_enabled from public.profile_settings', array[true], 'A push is enabled');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.save_push_subscription('https://push.example.test/endpoint-one', repeat('q', 24), repeat('b', 12), 'forged B')$$,
  '42501', 'subscription ownership proof mismatch', 'endpoint URL alone cannot steal a subscription'
);
select public.save_push_subscription('https://push.example.test/endpoint-one', repeat('p', 24), repeat('a', 12), 'test B');
select results_eq('select count(*)::bigint from public.push_subscriptions', array[1::bigint], 'B sees one transferred subscription');
select results_eq('select p256dh from public.push_subscriptions', array[repeat('p', 24)], 'transferred subscription keeps proven browser key');
select results_eq('select push_enabled from public.profile_settings', array[true], 'B push is enabled');
select results_eq('select user_id::text from public.push_subscriptions', array['a0000000-0000-0000-0000-000000000002'::text], 'endpoint belongs to B');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select results_eq('select push_enabled from public.profile_settings', array[false], 'A push is disabled after transfer');
select results_eq('select count(*)::bigint from public.push_subscriptions', array[0::bigint], 'A no longer sees the subscription');
select public.remove_push_subscription('https://push.example.test/endpoint-one');
select results_eq('select count(*)::bigint from public.push_subscriptions', array[0::bigint], 'A cannot see or remove B subscription');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select results_eq('select count(*)::bigint from public.push_subscriptions', array[1::bigint], 'B subscription remains after A removal');

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

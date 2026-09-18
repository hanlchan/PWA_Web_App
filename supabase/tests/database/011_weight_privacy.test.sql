begin;
select plan(13);

select has_table('public', 'weight_entries', 'weight table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.weight_entries'::regclass), 'weight RLS enabled');
select policies_are('public', 'weight_entries', array['weight_entries_owner_all'], 'weight table has owner-only policy');
select has_index('public', 'weight_entries', 'weight_entries_user_measured_idx', 'weight history has owner/time index');
select has_function('public', 'create_weight_entry', array['numeric','timestamp without time zone','public.weight_measurement_type'], 'create RPC exists');
select has_function('public', 'delete_weight_entry', array['uuid'], 'delete RPC exists');
select has_function('public', 'get_private_weight_dashboard', array[]::text[], 'private dashboard RPC exists');
select has_function('public', 'get_public_weight_trend', array['text'], 'public normalized trend RPC exists');
select function_privs_are('public', 'get_private_weight_dashboard', array[]::text[], 'anon', array[]::text[], 'anonymous users cannot read private weight dashboard');
select function_privs_are('public', 'get_public_weight_trend', array['text'], 'anon', array['EXECUTE'], 'anonymous users can execute only the normalized trend RPC');
select ok((select proargnames @> array['measured_date','normalized_index'] and not proargnames && array['weight_kg','height_cm','bmi'] from pg_proc where oid = 'public.get_public_weight_trend(text)'::regprocedure), 'public trend return signature excludes private measurements');

insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-000000000001', 'weight-a@example.invalid'),
  ('50000000-0000-0000-0000-000000000002', 'weight-b@example.invalid');
insert into public.profiles(id, username, display_name) values
  ('50000000-0000-0000-0000-000000000001', 'weight_user_a', 'Weight A'),
  ('50000000-0000-0000-0000-000000000002', 'weight_user_b', 'Weight B');
insert into public.profile_settings(user_id, timezone) values
  ('50000000-0000-0000-0000-000000000001', 'Asia/Shanghai'),
  ('50000000-0000-0000-0000-000000000002', 'Asia/Shanghai');
insert into public.weight_entries(id, user_id, weight_kg, measured_at, measurement_type)
values ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 76.50, now(), 'morning');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq('select count(*)::bigint from public.weight_entries where user_id = ''50000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot directly read B real weight');
select throws_ok('select public.delete_weight_entry(''60000000-0000-0000-0000-000000000002'')', 'P0002', 'weight entry not found', 'A cannot delete B weight entry through RPC');

select * from finish();
rollback;

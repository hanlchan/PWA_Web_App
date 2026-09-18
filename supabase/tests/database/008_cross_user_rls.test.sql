begin;
select plan(9);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'rls-b@example.invalid');

insert into public.profiles (id, username, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'rls_user_a', 'A'),
  ('10000000-0000-0000-0000-000000000002', 'rls_user_b', 'B');
insert into public.profile_settings (user_id, timezone)
values
  ('10000000-0000-0000-0000-000000000001', 'Asia/Shanghai'),
  ('10000000-0000-0000-0000-000000000002', 'Asia/Shanghai');
insert into public.workout_plans (id, user_id, title, recurrence_type, start_date)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A plan', 'one_time', current_date),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'B plan', 'one_time', current_date);
insert into public.plan_occurrences (id, plan_id, user_id, scheduled_date)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', current_date);
insert into public.checkins (id, user_id, occurrence_id, checkin_date)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq('select count(*)::bigint from public.profiles where id = ''10000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot read B profile');
select results_eq('select count(*)::bigint from public.profile_settings where user_id = ''10000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot read B settings');
select results_eq('select count(*)::bigint from public.workout_plans where user_id = ''10000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot read B plans');
select results_eq('select count(*)::bigint from public.plan_occurrences where user_id = ''10000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot read B occurrences');
select results_eq('select count(*)::bigint from public.checkins where user_id = ''10000000-0000-0000-0000-000000000002''', array[0::bigint], 'A cannot read B check-ins');
select throws_ok('select public.delete_workout_plan(''20000000-0000-0000-0000-000000000002'')', 'P0002', 'plan not found', 'A cannot delete B plan through RPC');
select throws_ok('select public.complete_occurrence(''30000000-0000-0000-0000-000000000002'')', 'P0002', 'occurrence unavailable', 'A cannot complete B occurrence');
select throws_ok('select public.update_checkin_details(''40000000-0000-0000-0000-000000000002'', 30, ''x'', ''x'')', 'P0002', 'checkin not found', 'A cannot edit B check-in');
select throws_ok('select public.reschedule_future_notifications(''10000000-0000-0000-0000-000000000002'')', '42501', 'forbidden', 'A cannot reschedule B notifications');

select * from finish();
rollback;

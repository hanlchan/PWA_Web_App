begin;
select plan(15);
select has_table('public','follows','follows exists');
select has_table('public','checkin_likes','likes exists');
select has_table('public','notifications','notifications exists');
select has_table('public','nudges','nudges exists');
select ok((select relrowsecurity from pg_class where oid='public.follows'::regclass),'follows RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.checkin_likes'::regclass),'likes RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.notifications'::regclass),'notifications RLS enabled');
select has_function('public','search_public_users',array['text'],'safe user search exists');
select has_function('public','get_following_feed',array['integer'],'safe feed exists');
select has_function('public','toggle_checkin_like',array['uuid'],'like RPC exists');
select has_function('public','send_nudge',array['uuid'],'nudge RPC exists');
select has_function('public','get_my_notifications',array['integer'],'private notification feed exists');
select function_privs_are('public','get_following_feed',array['integer'],'anon',array[]::text[],'anonymous users cannot read feed');
insert into auth.users(id,email) values
  ('70000000-0000-0000-0000-000000000001','social-a@example.invalid'),
  ('70000000-0000-0000-0000-000000000002','social-b@example.invalid');
insert into public.profiles(id,username,display_name) values
  ('70000000-0000-0000-0000-000000000001','social_user_a','Social A'),
  ('70000000-0000-0000-0000-000000000002','social_user_b','Social B');
insert into public.notifications(user_id,type,actor_id,data)
values('70000000-0000-0000-0000-000000000002','nudge','70000000-0000-0000-0000-000000000001','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select results_eq('select count(*)::bigint from public.notifications where user_id=''70000000-0000-0000-0000-000000000002''',array[0::bigint],'A cannot read B notifications');
select throws_ok('select public.send_nudge(''70000000-0000-0000-0000-000000000002'')','42501','follow required','nudge requires an active follow relation');
select * from finish();
rollback;

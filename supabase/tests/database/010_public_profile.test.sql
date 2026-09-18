begin;
select plan(4);

select has_function('public', 'get_public_user_profile', array['text', 'date'], 'public profile RPC exists');
select function_privs_are('public', 'get_public_user_profile', array['text', 'date'], 'anon', array['EXECUTE'], 'anonymous visitors can read safe public profiles');
select function_privs_are('public', 'get_public_user_profile', array['text', 'date'], 'authenticated', array['EXECUTE'], 'signed-in visitors can read safe public profiles');
select ok(
  position('weight' in lower(obj_description('public.get_public_user_profile(text,date)'::regprocedure, 'pg_proc'))) > 0,
  'function documents the private fields it excludes'
);

select * from finish();
rollback;

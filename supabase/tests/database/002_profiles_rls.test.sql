begin;
select plan(6);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.profile_settings'::regclass), 'settings RLS enabled');
select policies_are('public', 'profiles', array['profiles_insert_own', 'profiles_select_own', 'profiles_update_own'], 'profiles owner policies only');
select policies_are('public', 'profile_settings', array['profile_settings_insert_own', 'profile_settings_select_own', 'profile_settings_update_own'], 'settings owner policies only');
select is((select public from storage.buckets where id = 'avatars'), true, 'avatar bucket is public');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 5242880::bigint, 'avatar bucket is limited to 5MB');

select * from finish();
rollback;

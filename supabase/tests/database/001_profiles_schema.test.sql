begin;
select plan(12);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'profile_settings', 'profile_settings exists');
select has_column('public', 'profiles', 'username', 'profiles.username exists');
select has_column('public', 'profiles', 'display_name', 'profiles.display_name exists');
select has_column('public', 'profiles', 'avatar_path', 'profiles.avatar_path exists');
select has_column('public', 'profile_settings', 'timezone', 'settings.timezone exists');
select has_column('public', 'profile_settings', 'height_cm', 'settings.height exists');
select col_default_is('public', 'profile_settings', 'public_weight_trend', 'false', 'weight sharing defaults false');
select col_default_is('public', 'profile_settings', 'public_workout_details', 'false', 'details sharing defaults false');
select col_default_is('public', 'profile_settings', 'photo_default_visibility', 'private', 'photos default private');
select col_default_is('public', 'profile_settings', 'push_enabled', 'false', 'push defaults false');
select has_function('public', 'complete_onboarding', array['extensions.citext', 'text', 'numeric', 'text', 'text'], 'onboarding function exists');

select * from finish();
rollback;

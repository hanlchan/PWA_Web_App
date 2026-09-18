begin;
select plan(8);

select ok(not exists (
  select 1 from pg_trigger
  where tgrelid = 'public.profiles'::regclass and not tgisinternal
    and pg_get_triggerdef(oid) ilike '%workout_plans%'
), 'profile creation has no default-plan trigger');
select col_default_is('public', 'profile_settings', 'public_weight_trend', 'false', 'weight sharing remains private by default');
select col_default_is('public', 'profile_settings', 'public_workout_details', 'false', 'workout details remain private by default');
select col_default_is('public', 'profile_settings', 'photo_default_visibility', '''private''::text', 'photos remain private by default');
select has_index('public', 'checkins', 'checkins_occurrence_unique', 'an occurrence can be checked in only once');
select has_index('public', 'plan_occurrences', 'plan_occurrences_notification_due_idx', 'pending notifications have a partial index');
select function_privs_are('public', 'complete_occurrence', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated can execute completion RPC');
select function_privs_are('public', 'complete_occurrence', array['uuid'], 'anon', array[]::text[], 'anonymous users cannot execute completion RPC');

select * from finish();
rollback;

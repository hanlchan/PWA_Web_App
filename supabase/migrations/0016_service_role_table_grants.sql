-- New Supabase Secret Keys map to the service_role database role. RLS bypass
-- does not replace PostgreSQL table privileges, so trusted backend jobs need
-- explicit access before they can read subscriptions or write notifications.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.profile_settings,
  public.workout_plans,
  public.plan_custom_dates,
  public.plan_occurrences,
  public.checkins,
  public.weight_entries,
  public.follows,
  public.checkin_likes,
  public.notifications,
  public.nudges,
  public.push_subscriptions,
  public.progress_photos
to service_role;

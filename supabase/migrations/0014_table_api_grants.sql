-- Postgres checks table privileges before RLS. Grant the Data API roles access
-- to the operations that RLS policies will then constrain row by row.
grant usage on schema public to anon, authenticated;

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
to authenticated;

-- Anonymous access is intentionally limited to explicitly public photo rows.
-- The table's progress_photos_public_read RLS policy remains the final gate.
grant select on table public.progress_photos to anon;

with verification as (
  select 'profiles' table_name, count(*) row_count,
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text, '' order by ((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text), '')) content_hash
  from public.profiles t
  union all select 'profile_settings', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text, '' order by ((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text), ''))
  from public.profile_settings t
  union all select 'workout_plans', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at' - 'updated_at' - 'deleted_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at), 'deleted_at', extract(epoch from deleted_at)))::text, '' order by ((to_jsonb(t) - 'created_at' - 'updated_at' - 'deleted_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at), 'deleted_at', extract(epoch from deleted_at)))::text), ''))
  from public.workout_plans t
  union all select 'plan_custom_dates', count(*), md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) from public.plan_custom_dates t
  union all select 'plan_occurrences', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'notification_at' - 'reminder_sent_at' - 'created_at') || jsonb_build_object('notification_at', extract(epoch from notification_at), 'reminder_sent_at', extract(epoch from reminder_sent_at), 'created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'notification_at' - 'reminder_sent_at' - 'created_at') || jsonb_build_object('notification_at', extract(epoch from notification_at), 'reminder_sent_at', extract(epoch from reminder_sent_at), 'created_at', extract(epoch from created_at)))::text), ''))
  from public.plan_occurrences t
  union all select 'checkins', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'completed_at' - 'created_at' - 'updated_at') || jsonb_build_object('completed_at', extract(epoch from completed_at), 'created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text, '' order by ((to_jsonb(t) - 'completed_at' - 'created_at' - 'updated_at') || jsonb_build_object('completed_at', extract(epoch from completed_at), 'created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text), ''))
  from public.checkins t
  union all select 'weight_entries', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'measured_at' - 'created_at') || jsonb_build_object('measured_at', extract(epoch from measured_at), 'created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'measured_at' - 'created_at') || jsonb_build_object('measured_at', extract(epoch from measured_at), 'created_at', extract(epoch from created_at)))::text), ''))
  from public.weight_entries t
  union all select 'follows', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text), ''))
  from public.follows t
  union all select 'checkin_likes', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text), ''))
  from public.checkin_likes t
  union all select 'notifications', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'read_at' - 'created_at') || jsonb_build_object('read_at', extract(epoch from read_at), 'created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'read_at' - 'created_at') || jsonb_build_object('read_at', extract(epoch from read_at), 'created_at', extract(epoch from created_at)))::text), ''))
  from public.notifications t
  union all select 'nudges', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text), ''))
  from public.nudges t
  union all select 'push_subscriptions', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text, '' order by ((to_jsonb(t) - 'created_at' - 'updated_at') || jsonb_build_object('created_at', extract(epoch from created_at), 'updated_at', extract(epoch from updated_at)))::text), ''))
  from public.push_subscriptions t
  union all select 'progress_photos', count(*),
    md5(coalesce(string_agg(((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text, '' order by ((to_jsonb(t) - 'created_at') || jsonb_build_object('created_at', extract(epoch from created_at)))::text), ''))
  from public.progress_photos t
)
select table_name, row_count, content_hash
from verification
order by table_name;

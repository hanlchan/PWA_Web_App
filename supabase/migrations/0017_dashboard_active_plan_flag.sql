create or replace function public.get_today_dashboard() returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with context as (
  select auth.uid() uid,s.timezone,(now() at time zone s.timezone)::date today from public.profile_settings s where s.user_id=auth.uid()
), planned_days as (
  select o.scheduled_date,bool_and(o.status='completed') done from public.plan_occurrences o,context c
  where o.user_id=c.uid and o.scheduled_date<=c.today and o.status<>'cancelled' group by o.scheduled_date
), streak as (
  select count(*)::integer value from planned_days d where d.done and not exists(select 1 from planned_days newer where newer.scheduled_date>d.scheduled_date and not newer.done)
), occurrences as (
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',p.title,'description',p.description,'duration_minutes',p.duration_minutes,'scheduled_time',o.scheduled_time,'status',o.status) order by o.scheduled_time nulls last),'[]'::jsonb) value
  from context c left join public.plan_occurrences o on o.user_id=c.uid and o.scheduled_date=c.today and o.status<>'cancelled'
  left join public.workout_plans p on p.id=o.plan_id where o.id is not null
), today_checkins as (
  select coalesce(jsonb_agg(jsonb_build_object('id',ch.id,'occurrence_id',ch.occurrence_id,'checkin_date',ch.checkin_date,'duration_minutes',ch.duration_minutes)),'[]'::jsonb) value
  from public.checkins ch,context c where ch.user_id=c.uid and ch.checkin_date=c.today
)
select jsonb_build_object(
  'today',c.today,
  'has_active_plans',exists(select 1 from public.workout_plans p where p.user_id=c.uid and p.deleted_at is null),
  'today_occurrences',(select value from occurrences),
  'today_checkins',(select value from today_checkins),
  'total_checkin_days',(select count(distinct checkin_date) from public.checkins where user_id=c.uid),
  'current_streak',(select value from streak),
  'unread_notifications',0
) from context c;
$$;
revoke all on function public.get_today_dashboard() from public,anon;
grant execute on function public.get_today_dashboard() to authenticated;

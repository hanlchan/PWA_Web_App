create or replace function public.get_public_user_profile(p_username text, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
with target as (
  select p.id, p.username::text username, p.display_name, p.avatar_path
  from public.profiles p
  where p.username = lower(btrim(p_username))::extensions.citext
), month_context as (
  select date_trunc('month', p_month)::date month_start
), planned_days as (
  select o.scheduled_date, bool_and(o.status = 'completed') done
  from public.plan_occurrences o
  join target t on t.id = o.user_id
  where o.scheduled_date <= current_date and o.status <> 'cancelled'
  group by o.scheduled_date
), streak as (
  select count(*)::integer value
  from planned_days d
  where d.done and not exists (
    select 1 from planned_days newer
    where newer.scheduled_date > d.scheduled_date and not newer.done
  )
), public_dates as (
  select distinct c.checkin_date
  from public.checkins c
  join target t on t.id = c.user_id
  cross join month_context m
  where c.checkin_date >= m.month_start
    and c.checkin_date < m.month_start + interval '1 month'
  order by c.checkin_date
)
select jsonb_build_object(
  'username', t.username,
  'display_name', t.display_name,
  'avatar_path', t.avatar_path,
  'total_checkin_days', (select count(distinct c.checkin_date) from public.checkins c where c.user_id = t.id),
  'month_checkin_days', (select count(*) from public_dates),
  'current_streak', coalesce((select value from streak), 0),
  'checkin_dates', coalesce((select jsonb_agg(checkin_date order by checkin_date) from public_dates), '[]'::jsonb)
)
from target t;
$$;

revoke all on function public.get_public_user_profile(text, date) from public;
grant execute on function public.get_public_user_profile(text, date) to anon, authenticated;

comment on function public.get_public_user_profile(text, date) is
'Returns only public identity, aggregate check-in counts and exact check-in dates. Never returns email, height, notes, workout details or weight.';

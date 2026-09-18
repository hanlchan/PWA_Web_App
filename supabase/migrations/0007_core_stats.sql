create or replace function public.get_user_stats(p_month date) returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with c as(select auth.uid() uid,s.timezone,(now() at time zone s.timezone)::date today,date_trunc('month',p_month)::date month_start from public.profile_settings s where s.user_id=auth.uid()),
days as(select o.scheduled_date,bool_and(o.status='completed') done from public.plan_occurrences o,c where o.user_id=c.uid and o.scheduled_date<=c.today and o.status<>'cancelled' group by o.scheduled_date),
streak as(select count(*)::int value from days d where d.done and not exists(select 1 from days n where n.scheduled_date>d.scheduled_date and not n.done)),
rate as(select coalesce(round(100.0*count(*) filter(where done)/nullif(count(*),0)),0)::int value from days,c where scheduled_date between c.today-29 and c.today)
select jsonb_build_object(
 'total_days',(select count(distinct checkin_date) from public.checkins,c where user_id=c.uid),
 'month_days',(select count(distinct checkin_date) from public.checkins,c where user_id=c.uid and checkin_date>=c.month_start and checkin_date<c.month_start+interval '1 month'),
 'current_streak',(select value from streak),'completion_rate_30d',(select value from rate),
 'recorded_minutes',(select sum(duration_minutes) from public.checkins,c where user_id=c.uid)
) from c;
$$;

create or replace function public.get_calendar_month(p_month date)
returns table(scheduled_date date,state text)
language sql stable security definer set search_path=public,pg_catalog as $$
with c as(select auth.uid() uid,s.timezone,(now() at time zone s.timezone)::date today,date_trunc('month',p_month)::date first_day from public.profile_settings s where s.user_id=auth.uid()),
plans as(select o.scheduled_date,bool_and(o.status='completed') done from public.plan_occurrences o,c where o.user_id=c.uid and o.status<>'cancelled' and o.scheduled_date>=c.first_day and o.scheduled_date<c.first_day+interval '1 month' group by o.scheduled_date),
checks as(select distinct ch.checkin_date from public.checkins ch,c where ch.user_id=c.uid and ch.checkin_date>=c.first_day and ch.checkin_date<c.first_day+interval '1 month')
select coalesce(p.scheduled_date,ch.checkin_date),case when p.scheduled_date>c.today then 'future_planned' when p.scheduled_date is not null and p.done then 'planned_completed' when p.scheduled_date is not null then 'planned_pending' else 'manual_completed' end
from plans p full join checks ch on ch.checkin_date=p.scheduled_date cross join c order by 1;
$$;
revoke all on function public.get_user_stats(date),public.get_calendar_month(date) from public,anon;
grant execute on function public.get_user_stats(date),public.get_calendar_month(date) to authenticated;

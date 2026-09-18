create or replace function private_expand_plan_dates(p_plan_id uuid, p_from date, p_to date)
returns setof date
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with plan as (
    select * from public.workout_plans where id = p_plan_id and deleted_at is null
  ), candidates as (
    select d::date as scheduled_date
    from plan p cross join lateral generate_series(greatest(p.start_date, p_from), least(coalesce(p.end_date, p_to), p_to), interval '1 day') d
    where
      (p.recurrence_type = 'one_time' and d::date = p.start_date) or
      (p.recurrence_type = 'weekly' and extract(isodow from d)::smallint = any(p.days_of_week)) or
      (p.recurrence_type = 'monthly' and extract(day from d)::smallint = any(p.days_of_month))
    union
    select c.scheduled_date from plan p join public.plan_custom_dates c on c.plan_id = p.id
    where p.recurrence_type = 'custom_dates' and c.scheduled_date between greatest(p.start_date, p_from) and least(coalesce(p.end_date, p_to), p_to)
  ) select scheduled_date from candidates order by scheduled_date;
$$;

revoke all on function private_expand_plan_dates(uuid, date, date) from public, anon, authenticated;

create or replace function private_sync_plan_occurrences(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  p public.workout_plans%rowtype;
  tz text;
  local_today date;
begin
  select * into strict p from public.workout_plans where id = p_plan_id and deleted_at is null;
  select timezone into strict tz from public.profile_settings where user_id = p.user_id;
  local_today := (now() at time zone tz)::date;

  insert into public.plan_occurrences(plan_id, user_id, scheduled_date, scheduled_time, notification_at)
  select p.id, p.user_id, d, p.start_time,
    case when p.reminder_enabled then (d + coalesce(p.start_time, time '20:00')) at time zone tz else null end
  from private_expand_plan_dates(p.id, greatest(local_today, p.start_date), local_today + 89) d
  on conflict (plan_id, scheduled_date) do nothing;
end;
$$;

revoke all on function private_sync_plan_occurrences(uuid) from public, anon, authenticated;

create or replace function public.create_workout_plan(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  kind public.recurrence_type := (p_payload->>'recurrenceType')::public.recurrence_type;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;

  insert into public.workout_plans(
    user_id, title, description, duration_minutes, recurrence_type, start_date, end_date,
    days_of_week, days_of_month, start_time, reminder_enabled, notes
  ) values (
    uid, btrim(p_payload->>'title'), nullif(btrim(p_payload->>'description'), ''),
    nullif(p_payload->>'durationMinutes', '')::integer, kind, (p_payload->>'startDate')::date,
    nullif(p_payload->>'endDate', '')::date,
    case when kind = 'weekly' then array(select jsonb_array_elements_text(p_payload->'daysOfWeek')::smallint) end,
    case when kind = 'monthly' then array(select jsonb_array_elements_text(p_payload->'daysOfMonth')::smallint) end,
    nullif(p_payload->>'startTime', '')::time,
    coalesce((p_payload->>'reminderEnabled')::boolean, true), nullif(btrim(p_payload->>'notes'), '')
  ) returning id into new_id;

  if kind = 'custom_dates' then
    insert into public.plan_custom_dates(plan_id, scheduled_date)
    select new_id, value::date from jsonb_array_elements_text(p_payload->'customDates') value
    on conflict do nothing;
    if not exists(select 1 from public.plan_custom_dates where plan_id = new_id) then
      raise exception 'custom dates required' using errcode = '22023';
    end if;
  end if;

  perform private_sync_plan_occurrences(new_id);
  return new_id;
end;
$$;

create or replace function public.update_workout_plan(p_plan_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
  kind public.recurrence_type := (p_payload->>'recurrenceType')::public.recurrence_type;
begin
  if not exists(select 1 from public.workout_plans where id = p_plan_id and user_id = uid and deleted_at is null for update) then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  select timezone into strict tz from public.profile_settings where user_id = uid;
  local_today := (now() at time zone tz)::date;

  update public.workout_plans set
    title=btrim(p_payload->>'title'), description=nullif(btrim(p_payload->>'description'), ''),
    duration_minutes=nullif(p_payload->>'durationMinutes','')::integer, recurrence_type=kind,
    start_date=(p_payload->>'startDate')::date, end_date=nullif(p_payload->>'endDate','')::date,
    days_of_week=case when kind='weekly' then array(select jsonb_array_elements_text(p_payload->'daysOfWeek')::smallint) end,
    days_of_month=case when kind='monthly' then array(select jsonb_array_elements_text(p_payload->'daysOfMonth')::smallint) end,
    start_time=nullif(p_payload->>'startTime','')::time,
    reminder_enabled=coalesce((p_payload->>'reminderEnabled')::boolean,true), notes=nullif(btrim(p_payload->>'notes'),'')
  where id=p_plan_id;

  delete from public.plan_custom_dates where plan_id=p_plan_id;
  if kind='custom_dates' then
    insert into public.plan_custom_dates(plan_id,scheduled_date)
    select p_plan_id,value::date from jsonb_array_elements_text(p_payload->'customDates') value on conflict do nothing;
    if not exists(select 1 from public.plan_custom_dates where plan_id=p_plan_id) then
      raise exception 'custom dates required' using errcode='22023';
    end if;
  end if;
  delete from public.plan_occurrences where plan_id=p_plan_id and scheduled_date>=local_today and status<>'completed';
  perform private_sync_plan_occurrences(p_plan_id);
  return p_plan_id;
end;
$$;

create or replace function public.delete_workout_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid(); tz text; local_today date;
begin
  update public.workout_plans set deleted_at=now() where id=p_plan_id and user_id=uid and deleted_at is null;
  if not found then raise exception 'plan not found' using errcode='P0002'; end if;
  select timezone into strict tz from public.profile_settings where user_id=uid;
  local_today := (now() at time zone tz)::date;
  update public.plan_occurrences set status='cancelled', notification_at=null
  where plan_id=p_plan_id and scheduled_date>=local_today and status<>'completed';
end; $$;

create or replace function public.reschedule_future_notifications(p_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare tz text; local_today date;
begin
  if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'forbidden' using errcode='42501'; end if;
  select timezone into strict tz from public.profile_settings where user_id=p_user_id;
  local_today := (now() at time zone tz)::date;
  update public.plan_occurrences o set notification_at = case when p.reminder_enabled
    then (o.scheduled_date + coalesce(o.scheduled_time,time '20:00')) at time zone tz else null end
  from public.workout_plans p where p.id=o.plan_id and o.user_id=p_user_id and o.scheduled_date>=local_today
    and o.status='pending' and o.reminder_sent_at is null;
end; $$;

revoke all on function public.create_workout_plan(jsonb), public.update_workout_plan(uuid,jsonb), public.delete_workout_plan(uuid), public.reschedule_future_notifications(uuid) from public, anon;
grant execute on function public.create_workout_plan(jsonb), public.update_workout_plan(uuid,jsonb), public.delete_workout_plan(uuid), public.reschedule_future_notifications(uuid) to authenticated;

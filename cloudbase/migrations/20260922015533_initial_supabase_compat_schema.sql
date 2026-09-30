-- Generated from the audited Supabase migrations.
-- CloudBase compatibility changes:
--   * preserve business UUIDs and cast text auth.uid() in business SQL/RLS
--   * keep storage path identity comparisons as text
--   * omit the incompatible internal auth.users primary-key foreign key
--   * omit pg_net and pg_cron; CloudBase Functions and timer triggers replace them
-- Do not add secrets or production data to this migration.

-- Source: supabase/migrations/0001_extensions_and_types.sql
create extension if not exists citext with schema extensions;

create type public.recurrence_type as enum ('one_time', 'weekly', 'monthly', 'custom_dates');
create type public.occurrence_status as enum ('pending', 'completed', 'skipped', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create or replace function public.is_valid_timezone(value text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists(select 1 from pg_timezone_names where name = value);
$$;

revoke all on function public.is_valid_timezone(text) from public;
grant execute on function public.is_valid_timezone(text) to authenticated;

-- Source: supabase/migrations/0002_profiles.sql
create table public.profiles (
  id uuid primary key,
  username extensions.citext not null unique,
  display_name varchar(50) not null check (char_length(btrim(display_name)) between 1 and 50),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username::text ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$'
  )
);

create table public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric(5,2) check (height_cm is null or height_cm between 50 and 300),
  timezone text not null check (public.is_valid_timezone(timezone)),
  public_weight_trend boolean not null default false,
  public_workout_details boolean not null default false,
  photo_default_visibility text not null default 'private'
    check (photo_default_visibility in ('private', 'public')),
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_settings_set_updated_at
before update on public.profile_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_settings enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid()::uuid);
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = auth.uid()::uuid);
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()::uuid) with check (id = auth.uid()::uuid);

create policy profile_settings_select_own on public.profile_settings
for select to authenticated using (user_id = auth.uid()::uuid);
create policy profile_settings_insert_own on public.profile_settings
for insert to authenticated with check (user_id = auth.uid()::uuid);
create policy profile_settings_update_own on public.profile_settings
for update to authenticated using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid);

create or replace function public.complete_onboarding(
  p_username extensions.citext,
  p_display_name text,
  p_height_cm numeric,
  p_timezone text,
  p_avatar_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $$
declare
  current_user_id uuid := auth.uid()::uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.profiles (id, username, display_name, avatar_path)
  values (current_user_id, lower(btrim(p_username::text))::extensions.citext, btrim(p_display_name), p_avatar_path);

  insert into public.profile_settings (user_id, height_cm, timezone)
  values (current_user_id, p_height_cm, p_timezone);

  return current_user_id;
end;
$$;

revoke all on function public.complete_onboarding(extensions.citext, text, numeric, text, text) from public;
grant execute on function public.complete_onboarding(extensions.citext, text, numeric, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatar_public_read on storage.objects
for select to public using (bucket_id = 'avatars');

create policy avatar_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()
);

create policy avatar_update_own on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()
);

create policy avatar_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()
);

-- Source: supabase/migrations/0003_workout_plans.sql
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(100) not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  recurrence_type public.recurrence_type not null,
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  days_of_week smallint[],
  days_of_month smallint[],
  start_time time,
  reminder_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_plans_recurrence_payload check (
    (recurrence_type = 'one_time' and days_of_week is null and days_of_month is null) or
    (recurrence_type = 'weekly' and cardinality(days_of_week) > 0 and days_of_month is null) or
    (recurrence_type = 'monthly' and cardinality(days_of_month) > 0 and days_of_week is null) or
    (recurrence_type = 'custom_dates' and days_of_week is null and days_of_month is null)
  ),
  constraint workout_plans_weekdays check (
    days_of_week is null or days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint workout_plans_monthdays check (
    days_of_month is null or days_of_month <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
    ]::smallint[]
  )
);

create table public.plan_custom_dates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  scheduled_date date not null,
  unique (plan_id, scheduled_date)
);

create table public.plan_occurrences (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  notification_at timestamptz,
  reminder_sent_at timestamptz,
  status public.occurrence_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint plan_occurrences_plan_date_key unique (plan_id, scheduled_date)
);

create index plan_occurrences_user_date_idx on public.plan_occurrences(user_id, scheduled_date);
create index plan_occurrences_notification_due_idx on public.plan_occurrences(notification_at)
where notification_at is not null and reminder_sent_at is null and status = 'pending';

create trigger workout_plans_set_updated_at before update on public.workout_plans
for each row execute function public.set_updated_at();

alter table public.workout_plans enable row level security;
alter table public.plan_custom_dates enable row level security;
alter table public.plan_occurrences enable row level security;

create policy workout_plans_owner_all on public.workout_plans for all to authenticated
using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid);
create policy plan_custom_dates_owner_all on public.plan_custom_dates for all to authenticated
using (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()::uuid))
with check (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()::uuid));
create policy plan_occurrences_owner_all on public.plan_occurrences for all to authenticated
using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid);

-- Source: supabase/migrations/0004_occurrence_functions.sql
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
  uid uuid := auth.uid()::uuid;
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
  uid uuid := auth.uid()::uuid;
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
declare uid uuid:=auth.uid()::uuid; tz text; local_today date;
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
  if auth.uid()::uuid is null or auth.uid()::uuid<>p_user_id then raise exception 'forbidden' using errcode='42501'; end if;
  select timezone into strict tz from public.profile_settings where user_id=p_user_id;
  local_today := (now() at time zone tz)::date;
  update public.plan_occurrences o set notification_at = case when p.reminder_enabled
    then (o.scheduled_date + coalesce(o.scheduled_time,time '20:00')) at time zone tz else null end
  from public.workout_plans p where p.id=o.plan_id and o.user_id=p_user_id and o.scheduled_date>=local_today
    and o.status='pending' and o.reminder_sent_at is null;
end; $$;

revoke all on function public.create_workout_plan(jsonb), public.update_workout_plan(uuid,jsonb), public.delete_workout_plan(uuid), public.reschedule_future_notifications(uuid) from public, anon;
grant execute on function public.create_workout_plan(jsonb), public.update_workout_plan(uuid,jsonb), public.delete_workout_plan(uuid), public.reschedule_future_notifications(uuid) to authenticated;

-- Source: supabase/migrations/0005_checkins.sql
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurrence_id uuid references public.plan_occurrences(id),
  checkin_date date not null,
  completed_at timestamptz not null default now(),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  activity_text text,
  notes text,
  is_backfilled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index checkins_occurrence_unique on public.checkins(occurrence_id) where occurrence_id is not null;
create index checkins_user_date_idx on public.checkins(user_id, checkin_date);
create trigger checkins_set_updated_at before update on public.checkins for each row execute function public.set_updated_at();
alter table public.checkins enable row level security;
create policy checkins_owner_all on public.checkins for all to authenticated using(user_id=auth.uid()::uuid) with check(user_id=auth.uid()::uuid);

create or replace function public.complete_occurrence(p_occurrence_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid()::uuid; occurrence public.plan_occurrences%rowtype; result uuid;
begin
  select * into occurrence from public.plan_occurrences where id=p_occurrence_id and user_id=uid for update;
  if not found or occurrence.status in ('cancelled','skipped') then raise exception 'occurrence unavailable' using errcode='P0002'; end if;
  insert into public.checkins(user_id,occurrence_id,checkin_date) values(uid,occurrence.id,occurrence.scheduled_date)
  on conflict (occurrence_id) where occurrence_id is not null do update set completed_at=excluded.completed_at returning id into result;
  update public.plan_occurrences set status='completed' where id=occurrence.id;
  return result;
end; $$;

create or replace function public.create_manual_checkin(p_checkin_date date,p_is_backfilled boolean) returns uuid
language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid()::uuid; tz text; today date; result uuid;
begin
  select timezone into strict tz from public.profile_settings where user_id=uid;
  today:=(now() at time zone tz)::date;
  if p_checkin_date>today or p_checkin_date<today-7 then raise exception 'date outside backfill window' using errcode='22023'; end if;
  insert into public.checkins(user_id,checkin_date,is_backfilled) values(uid,p_checkin_date,p_is_backfilled or p_checkin_date<today) returning id into result;
  return result;
end; $$;

create or replace function public.update_checkin_details(p_checkin_id uuid,p_duration_minutes integer,p_activity_text text,p_notes text) returns void
language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  update public.checkins set duration_minutes=p_duration_minutes,activity_text=nullif(btrim(p_activity_text),''),notes=nullif(btrim(p_notes),'') where id=p_checkin_id and user_id=auth.uid()::uuid;
  if not found then raise exception 'checkin not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.undo_checkin(p_checkin_id uuid) returns void
language plpgsql security definer set search_path=public,pg_catalog as $$
declare occurrence uuid;
begin
  delete from public.checkins where id=p_checkin_id and user_id=auth.uid()::uuid returning occurrence_id into occurrence;
  if not found then raise exception 'checkin not found' using errcode='P0002'; end if;
  if occurrence is not null then update public.plan_occurrences set status='pending' where id=occurrence and user_id=auth.uid()::uuid; end if;
end; $$;

revoke all on function public.complete_occurrence(uuid),public.create_manual_checkin(date,boolean),public.update_checkin_details(uuid,integer,text,text),public.undo_checkin(uuid) from public,anon;
grant execute on function public.complete_occurrence(uuid),public.create_manual_checkin(date,boolean),public.update_checkin_details(uuid,integer,text,text),public.undo_checkin(uuid) to authenticated;

-- Source: supabase/migrations/0006_dashboard_and_stats.sql
create or replace function public.get_today_dashboard() returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with context as (
  select auth.uid()::uuid uid,s.timezone,(now() at time zone s.timezone)::date today from public.profile_settings s where s.user_id=auth.uid()::uuid
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
select jsonb_build_object('today',c.today,'today_occurrences',(select value from occurrences),'today_checkins',(select value from today_checkins),
  'total_checkin_days',(select count(distinct checkin_date) from public.checkins where user_id=c.uid),
  'current_streak',(select value from streak),'unread_notifications',0) from context c;
$$;
revoke all on function public.get_today_dashboard() from public,anon;
grant execute on function public.get_today_dashboard() to authenticated;

-- Source: supabase/migrations/0007_core_stats.sql
create or replace function public.get_user_stats(p_month date) returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with c as(select auth.uid()::uuid uid,s.timezone,(now() at time zone s.timezone)::date today,date_trunc('month',p_month)::date month_start from public.profile_settings s where s.user_id=auth.uid()::uuid),
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
with c as(select auth.uid()::uuid uid,s.timezone,(now() at time zone s.timezone)::date today,date_trunc('month',p_month)::date first_day from public.profile_settings s where s.user_id=auth.uid()::uuid),
plans as(select o.scheduled_date,bool_and(o.status='completed') done from public.plan_occurrences o,c where o.user_id=c.uid and o.status<>'cancelled' and o.scheduled_date>=c.first_day and o.scheduled_date<c.first_day+interval '1 month' group by o.scheduled_date),
checks as(select distinct ch.checkin_date from public.checkins ch,c where ch.user_id=c.uid and ch.checkin_date>=c.first_day and ch.checkin_date<c.first_day+interval '1 month')
select coalesce(p.scheduled_date,ch.checkin_date),case when p.scheduled_date>c.today then 'future_planned' when p.scheduled_date is not null and p.done then 'planned_completed' when p.scheduled_date is not null then 'planned_pending' else 'manual_completed' end
from plans p full join checks ch on ch.checkin_date=p.scheduled_date cross join c order by 1;
$$;
revoke all on function public.get_user_stats(date),public.get_calendar_month(date) from public,anon;
grant execute on function public.get_user_stats(date),public.get_calendar_month(date) to authenticated;

-- Source: supabase/migrations/0008_public_profiles.sql
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

-- Source: supabase/migrations/0009_weight_entries.sql
create type public.weight_measurement_type as enum ('morning', 'evening', 'custom');

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  measured_at timestamptz not null default now(),
  measurement_type public.weight_measurement_type not null default 'custom',
  created_at timestamptz not null default now()
);

create index weight_entries_user_measured_idx
on public.weight_entries(user_id, measured_at desc);

alter table public.weight_entries enable row level security;
create policy weight_entries_owner_all on public.weight_entries
for all to authenticated
using (user_id = auth.uid()::uuid)
with check (user_id = auth.uid()::uuid);

create or replace function public.create_weight_entry(
  p_weight_kg numeric,
  p_measured_at timestamp without time zone,
  p_measurement_type public.weight_measurement_type
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid()::uuid;
  result uuid;
  tz text;
  measured_utc timestamptz;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_weight_kg < 20 or p_weight_kg > 500 then raise exception 'weight out of range' using errcode = '22023'; end if;
  select timezone into strict tz from public.profile_settings where user_id = uid;
  measured_utc := p_measured_at at time zone tz;
  if measured_utc > now() + interval '5 minutes' then raise exception 'future measurement not allowed' using errcode = '22023'; end if;

  insert into public.weight_entries(user_id, weight_kg, measured_at, measurement_type)
  values(uid, p_weight_kg, measured_utc, p_measurement_type)
  returning id into result;
  return result;
end;
$$;

create or replace function public.delete_weight_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.weight_entries where id = p_entry_id and user_id = auth.uid()::uuid;
  if not found then raise exception 'weight entry not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.get_private_weight_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
select jsonb_build_object(
  'height_cm', s.height_cm,
  'entries', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id,
      'weight_kg', w.weight_kg,
      'measured_at', w.measured_at,
      'measurement_type', w.measurement_type,
      'bmi', case when s.height_cm is null then null else round(w.weight_kg / power(s.height_cm / 100.0, 2), 1) end
    ) order by w.measured_at)
    from public.weight_entries w where w.user_id = auth.uid()::uuid
  ), '[]'::jsonb)
)
from public.profile_settings s
where s.user_id = auth.uid()::uuid;
$$;

create or replace function public.get_public_weight_trend(p_username text)
returns table(measured_date date, normalized_index numeric)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
with target as (
  select p.id, s.timezone
  from public.profiles p
  join public.profile_settings s on s.user_id = p.id
  where p.username = lower(btrim(p_username))::extensions.citext
    and s.public_weight_trend = true
), daily as (
  select distinct on ((w.measured_at at time zone t.timezone)::date)
    (w.measured_at at time zone t.timezone)::date measured_date,
    w.weight_kg
  from public.weight_entries w
  join target t on t.id = w.user_id
  order by (w.measured_at at time zone t.timezone)::date, w.measured_at desc
), normalized as (
  select measured_date, weight_kg,
    first_value(weight_kg) over(order by measured_date rows between unbounded preceding and unbounded following) baseline
  from daily
)
select measured_date, round(weight_kg / nullif(baseline, 0) * 100, 2) normalized_index
from normalized
order by measured_date;
$$;

revoke all on function public.create_weight_entry(numeric,timestamp without time zone,public.weight_measurement_type), public.delete_weight_entry(uuid), public.get_private_weight_dashboard() from public, anon;
grant execute on function public.create_weight_entry(numeric,timestamp without time zone,public.weight_measurement_type), public.delete_weight_entry(uuid), public.get_private_weight_dashboard() to authenticated;
revoke all on function public.get_public_weight_trend(text) from public;
grant execute on function public.get_public_weight_trend(text) to anon, authenticated;

comment on function public.get_public_weight_trend(text) is
'Returns only local date and baseline-normalized index. It never returns kilograms, BMI, height, or a baseline value.';

-- Source: supabase/migrations/0010_social.sql
create type public.notification_type as enum ('workout_reminder', 'nudge', 'like');

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table public.checkin_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  nudge_date date not null,
  created_at timestamptz not null default now(),
  unique(actor_id, target_id, nudge_date),
  constraint nudges_not_self check (actor_id <> target_id)
);

create index follows_following_idx on public.follows(following_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index checkin_likes_checkin_idx on public.checkin_likes(checkin_id);

alter table public.follows enable row level security;
alter table public.checkin_likes enable row level security;
alter table public.notifications enable row level security;
alter table public.nudges enable row level security;

create policy follows_visible_to_participants on public.follows for select to authenticated
using (follower_id = auth.uid()::uuid or following_id = auth.uid()::uuid);
create policy follows_insert_self on public.follows for insert to authenticated
with check (follower_id = auth.uid()::uuid and following_id <> auth.uid()::uuid);
create policy follows_delete_self on public.follows for delete to authenticated
using (follower_id = auth.uid()::uuid);
create policy checkin_likes_owner_select on public.checkin_likes for select to authenticated using (user_id = auth.uid()::uuid);
create policy checkin_likes_owner_delete on public.checkin_likes for delete to authenticated using (user_id = auth.uid()::uuid);
create policy notifications_owner_select on public.notifications for select to authenticated using (user_id = auth.uid()::uuid);
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid);
create policy nudges_participant_select on public.nudges for select to authenticated using (actor_id = auth.uid()::uuid or target_id = auth.uid()::uuid);

create or replace function public.search_public_users(p_query text)
returns table(id uuid, username text, display_name text, avatar_path text, is_following boolean)
language sql stable security definer set search_path = public, pg_catalog as $$
  select p.id, p.username::text, p.display_name, p.avatar_path,
    exists(select 1 from public.follows f where f.follower_id = auth.uid()::uuid and f.following_id = p.id)
  from public.profiles p
  where auth.uid()::uuid is not null and p.id <> auth.uid()::uuid
    and char_length(btrim(p_query)) between 2 and 30
    and (position(lower(btrim(p_query)) in lower(p.username::text)) > 0 or position(lower(btrim(p_query)) in lower(p.display_name)) > 0)
  order by case when lower(p.username::text) = lower(btrim(p_query)) then 0 else 1 end, p.username
  limit 20;
$$;

create or replace function public.toggle_follow(p_target_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare uid uuid := auth.uid()::uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if uid = p_target_id then raise exception 'cannot follow yourself' using errcode = '22023'; end if;
  if not exists(select 1 from public.profiles where id = p_target_id) then raise exception 'user not found' using errcode = 'P0002'; end if;
  delete from public.follows where follower_id = uid and following_id = p_target_id;
  if found then return false; end if;
  insert into public.follows(follower_id, following_id) values(uid, p_target_id);
  return true;
end; $$;

create or replace function public.get_following_feed(p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = public, pg_catalog as $$
with followed as (
  select f.following_id from public.follows f where f.follower_id = auth.uid()::uuid
), days as (
  select c.user_id, c.checkin_date, min(c.id::text)::uuid checkin_id, max(c.completed_at) completed_at
  from public.checkins c join followed f on f.following_id = c.user_id
  where c.checkin_date >= current_date - 30
  group by c.user_id, c.checkin_date
  order by completed_at desc limit greatest(1, least(coalesce(p_limit, 30), 50))
)
select coalesce(jsonb_agg(jsonb_build_object(
  'checkin_id', d.checkin_id, 'checkin_date', d.checkin_date, 'completed_at', d.completed_at,
  'user_id', p.id, 'username', p.username::text, 'display_name', p.display_name, 'avatar_path', p.avatar_path,
  'total_checkin_days', (select count(distinct c2.checkin_date) from public.checkins c2 where c2.user_id = p.id),
  'like_count', (select count(*) from public.checkin_likes l where l.checkin_id = d.checkin_id),
  'liked_by_me', exists(select 1 from public.checkin_likes l where l.checkin_id = d.checkin_id and l.user_id = auth.uid()::uuid),
  'can_nudge', exists(select 1 from public.plan_occurrences o join public.profile_settings s on s.user_id = o.user_id where o.user_id = p.id and o.scheduled_date = (now() at time zone s.timezone)::date and o.status = 'pending')
) order by d.completed_at desc), '[]'::jsonb)
from days d join public.profiles p on p.id = d.user_id;
$$;

create or replace function public.toggle_checkin_like(p_checkin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare uid uuid := auth.uid()::uuid; owner_id uuid;
begin
  select c.user_id into owner_id from public.checkins c where c.id = p_checkin_id;
  if uid is null or owner_id is null then raise exception 'checkin not found' using errcode = 'P0002'; end if;
  if owner_id <> uid and not exists(select 1 from public.follows where follower_id = uid and following_id = owner_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.checkin_likes where user_id = uid and checkin_id = p_checkin_id;
  if found then
    delete from public.notifications where user_id = owner_id and actor_id = uid and type = 'like' and data->>'checkin_id' = p_checkin_id::text;
    return false;
  end if;
  insert into public.checkin_likes(user_id, checkin_id) values(uid, p_checkin_id);
  if owner_id <> uid then insert into public.notifications(user_id, type, actor_id, data) values(owner_id, 'like', uid, jsonb_build_object('checkin_id', p_checkin_id)); end if;
  return true;
end; $$;

create or replace function public.send_nudge(p_target_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare uid uuid := auth.uid()::uuid; target_today date; result uuid;
begin
  if uid is null or uid = p_target_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists(select 1 from public.follows where follower_id = uid and following_id = p_target_id) then raise exception 'follow required' using errcode = '42501'; end if;
  select (now() at time zone s.timezone)::date into strict target_today from public.profile_settings s where s.user_id = p_target_id;
  if not exists(select 1 from public.plan_occurrences where user_id = p_target_id and scheduled_date = target_today and status = 'pending') then raise exception 'no pending workout' using errcode = '22023'; end if;
  insert into public.nudges(actor_id, target_id, nudge_date) values(uid, p_target_id, target_today)
  on conflict(actor_id, target_id, nudge_date) do nothing returning id into result;
  if result is null then raise exception 'already nudged today' using errcode = '23505'; end if;
  insert into public.notifications(user_id, type, actor_id, data) values(p_target_id, 'nudge', uid, jsonb_build_object('nudge_date', target_today));
  return result;
end; $$;

create or replace function public.get_my_notifications(p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = public, pg_catalog as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', n.id, 'type', n.type, 'data', n.data, 'read_at', n.read_at, 'created_at', n.created_at,
  'actor_username', p.username::text, 'actor_display_name', p.display_name
) order by n.created_at desc), '[]'::jsonb)
from (select * from public.notifications where user_id = auth.uid()::uuid order by created_at desc limit greatest(1, least(coalesce(p_limit,30),50))) n
left join public.profiles p on p.id = n.actor_id;
$$;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public, pg_catalog as $$
  update public.notifications set read_at = now() where user_id = auth.uid()::uuid and read_at is null;
$$;

revoke all on function public.search_public_users(text), public.toggle_follow(uuid), public.get_following_feed(integer), public.toggle_checkin_like(uuid), public.send_nudge(uuid), public.get_my_notifications(integer), public.mark_notifications_read() from public, anon;
grant execute on function public.search_public_users(text), public.toggle_follow(uuid), public.get_following_feed(integer), public.toggle_checkin_like(uuid), public.send_nudge(uuid), public.get_my_notifications(integer), public.mark_notifications_read() to authenticated;

create or replace function public.get_today_dashboard() returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with context as (
  select auth.uid()::uuid uid,s.timezone,(now() at time zone s.timezone)::date today from public.profile_settings s where s.user_id=auth.uid()::uuid
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
select jsonb_build_object('today',c.today,'today_occurrences',(select value from occurrences),'today_checkins',(select value from today_checkins),
  'total_checkin_days',(select count(distinct checkin_date) from public.checkins where user_id=c.uid),
  'current_streak',(select value from streak),'unread_notifications',(select count(*) from public.notifications where user_id=c.uid and read_at is null)) from context c;
$$;

-- Source: supabase/migrations/0011_push_and_jobs.sql

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_owner_all on public.push_subscriptions for all to authenticated
using(user_id = auth.uid()::uuid) with check(user_id = auth.uid()::uuid);

create unique index notifications_workout_occurrence_unique
on public.notifications(user_id, ((data->>'occurrence_id')))
where type = 'workout_reminder' and data ? 'occurrence_id';

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid()::uuid; result uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(p_endpoint) not between 20 and 4096 or char_length(p_p256dh) not between 20 and 512 or char_length(p_auth) not between 8 and 256 then raise exception 'invalid subscription' using errcode='22023'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent)
  values(uid,p_endpoint,p_p256dh,p_auth,left(p_user_agent,500))
  on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent
  returning id into result;
  update public.profile_settings set push_enabled=true where user_id=uid;
  return result;
end; $$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid()::uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  delete from public.push_subscriptions where user_id=uid and endpoint=p_endpoint;
  if not exists(select 1 from public.push_subscriptions where user_id=uid) then update public.profile_settings set push_enabled=false where user_id=uid; end if;
end; $$;

create or replace function public.generate_all_occurrences()
returns integer language plpgsql security definer set search_path=public,pg_catalog as $$
declare item record; processed integer:=0;
begin
  for item in select id from public.workout_plans where deleted_at is null loop
    perform private_sync_plan_occurrences(item.id);
    processed:=processed+1;
  end loop;
  return processed;
end; $$;

create or replace function public.claim_due_reminders(p_limit integer default 100)
returns table(occurrence_id uuid,user_id uuid,title text,scheduled_time time)
language sql security definer set search_path=public,pg_catalog as $$
with due as (
  select o.id from public.plan_occurrences o
  where o.notification_at<=now() and o.reminder_sent_at is null and o.status='pending'
  order by o.notification_at for update skip locked limit greatest(1,least(coalesce(p_limit,100),500))
), claimed as (
  update public.plan_occurrences o set reminder_sent_at=now()
  from due where o.id=due.id
  returning o.id,o.user_id,o.plan_id,o.scheduled_time
)
select c.id,c.user_id,p.title::text,c.scheduled_time from claimed c join public.workout_plans p on p.id=c.plan_id;
$$;

revoke all on function public.save_push_subscription(text,text,text,text),public.remove_push_subscription(text) from public,anon;
grant execute on function public.save_push_subscription(text,text,text,text),public.remove_push_subscription(text) to authenticated;
revoke all on function public.generate_all_occurrences(),public.claim_due_reminders(integer) from public,anon,authenticated;
grant execute on function public.generate_all_occurrences(),public.claim_due_reminders(integer) to service_role;

-- Source: supabase/migrations/0012_progress_photos.sql
create type public.photo_visibility as enum ('private', 'public');

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  photo_date date not null,
  note varchar(500),
  visibility public.photo_visibility not null default 'private',
  created_at timestamptz not null default now(),
  constraint progress_photos_owned_path check (
    storage_path like user_id::text || '/%'
    and storage_path !~ '(^|/)\.\.(/|$)'
  )
);

create index progress_photos_user_date_idx
on public.progress_photos(user_id, photo_date desc, created_at desc);

alter table public.progress_photos enable row level security;

create policy progress_photos_owner_all on public.progress_photos
for all to authenticated
using (user_id = auth.uid()::uuid)
with check (user_id = auth.uid()::uuid);

create policy progress_photos_public_read on public.progress_photos
for select to anon, authenticated
using (visibility = 'public');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy progress_photo_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()
);

create or replace function public.is_progress_photo_public(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.progress_photos photo
    where photo.storage_path = p_storage_path
      and photo.visibility = 'public'
  );
$$;

revoke all on function public.is_progress_photo_public(text) from public;
grant execute on function public.is_progress_photo_public(text) to anon, authenticated;

create policy progress_photo_read_allowed on storage.objects
for select to anon, authenticated using (
  bucket_id = 'progress-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()
    or public.is_progress_photo_public(name)
  )
);

create policy progress_photo_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()
);

create or replace function public.get_public_progress_photos(p_username text)
returns table(
  id uuid,
  storage_path text,
  photo_date date,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
  select photo.id, photo.storage_path, photo.photo_date, photo.note::text, photo.created_at
  from public.progress_photos photo
  join public.profiles profile on profile.id = photo.user_id
  where profile.username = lower(btrim(p_username))::extensions.citext
    and photo.visibility = 'public'
  order by photo.photo_date desc, photo.created_at desc;
$$;

revoke all on function public.get_public_progress_photos(text) from public;
grant execute on function public.get_public_progress_photos(text) to anon, authenticated;

comment on function public.get_public_progress_photos(text) is
'Returns metadata only for explicitly public progress photos. File access still requires a short-lived Storage signed URL.';

comment on function public.is_progress_photo_public(text) is
'Storage RLS helper that returns true only when a photo record was explicitly marked public.';

-- Source: supabase/migrations/0013_enable_pgtap.sql
-- pgTAP is used only by the transactional database security test suite.
create extension if not exists pgtap with schema extensions;

-- Source: supabase/migrations/0014_table_api_grants.sql
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

-- Source: supabase/migrations/0015_enforce_checkin_date_window.sql
create or replace function public.complete_occurrence(p_occurrence_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  uid uuid := auth.uid()::uuid;
  occurrence public.plan_occurrences%rowtype;
  tz text;
  today date;
  result uuid;
begin
  select timezone into strict tz from public.profile_settings where user_id = uid;
  today := (now() at time zone tz)::date;
  select * into occurrence from public.plan_occurrences where id = p_occurrence_id and user_id = uid for update;
  if not found or occurrence.status in ('cancelled', 'skipped') then
    raise exception 'occurrence unavailable' using errcode = 'P0002';
  end if;
  if occurrence.scheduled_date > today or occurrence.scheduled_date < today - 7 then
    raise exception 'date outside backfill window' using errcode = '22023';
  end if;
  insert into public.checkins(user_id, occurrence_id, checkin_date)
  values(uid, occurrence.id, occurrence.scheduled_date)
  on conflict (occurrence_id) where occurrence_id is not null
  do update set completed_at = excluded.completed_at
  returning id into result;
  update public.plan_occurrences set status = 'completed' where id = occurrence.id;
  return result;
end;
$$;

revoke all on function public.complete_occurrence(uuid) from public, anon;
grant execute on function public.complete_occurrence(uuid) to authenticated;

-- Source: supabase/migrations/0016_service_role_table_grants.sql
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

-- Source: supabase/migrations/0017_dashboard_active_plan_flag.sql
create or replace function public.get_today_dashboard() returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with context as (
  select auth.uid()::uuid uid,s.timezone,(now() at time zone s.timezone)::date today from public.profile_settings s where s.user_id=auth.uid()::uuid
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

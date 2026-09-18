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
create policy checkins_owner_all on public.checkins for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.complete_occurrence(p_occurrence_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid(); occurrence public.plan_occurrences%rowtype; result uuid;
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
declare uid uuid:=auth.uid(); tz text; today date; result uuid;
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
  update public.checkins set duration_minutes=p_duration_minutes,activity_text=nullif(btrim(p_activity_text),''),notes=nullif(btrim(p_notes),'') where id=p_checkin_id and user_id=auth.uid();
  if not found then raise exception 'checkin not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.undo_checkin(p_checkin_id uuid) returns void
language plpgsql security definer set search_path=public,pg_catalog as $$
declare occurrence uuid;
begin
  delete from public.checkins where id=p_checkin_id and user_id=auth.uid() returning occurrence_id into occurrence;
  if not found then raise exception 'checkin not found' using errcode='P0002'; end if;
  if occurrence is not null then update public.plan_occurrences set status='pending' where id=occurrence and user_id=auth.uid(); end if;
end; $$;

revoke all on function public.complete_occurrence(uuid),public.create_manual_checkin(date,boolean),public.update_checkin_details(uuid,integer,text,text),public.undo_checkin(uuid) from public,anon;
grant execute on function public.complete_occurrence(uuid),public.create_manual_checkin(date,boolean),public.update_checkin_details(uuid,integer,text,text),public.undo_checkin(uuid) to authenticated;

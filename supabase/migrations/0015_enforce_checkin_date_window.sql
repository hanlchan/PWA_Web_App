create or replace function public.complete_occurrence(p_occurrence_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  uid uuid := auth.uid();
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

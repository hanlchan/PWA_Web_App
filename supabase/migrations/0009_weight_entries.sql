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
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
  uid uuid := auth.uid();
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
  delete from public.weight_entries where id = p_entry_id and user_id = auth.uid();
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
    from public.weight_entries w where w.user_id = auth.uid()
  ), '[]'::jsonb)
)
from public.profile_settings s
where s.user_id = auth.uid();
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

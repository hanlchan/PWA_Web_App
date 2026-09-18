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

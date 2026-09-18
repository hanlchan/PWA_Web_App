create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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
for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profile_settings_select_own on public.profile_settings
for select to authenticated using (user_id = auth.uid());
create policy profile_settings_insert_own on public.profile_settings
for insert to authenticated with check (user_id = auth.uid());
create policy profile_settings_update_own on public.profile_settings
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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
  current_user_id uuid := auth.uid();
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
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatar_update_own on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatar_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

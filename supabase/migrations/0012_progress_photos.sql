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
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
  and (storage.foldername(name))[1] = auth.uid()::text
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
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_progress_photo_public(name)
  )
);

create policy progress_photo_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
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

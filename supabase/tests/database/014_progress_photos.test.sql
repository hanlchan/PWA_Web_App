begin;
select plan(20);

select has_table('public', 'progress_photos', 'progress photos table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.progress_photos'::regclass), 'progress photos RLS enabled');
select policies_are('public', 'progress_photos', array['progress_photos_owner_all', 'progress_photos_public_read'], 'photo metadata has owner and explicit public read policies');
select has_index('public', 'progress_photos', 'progress_photos_user_date_idx', 'photo history has owner/date index');
select col_default_is('public', 'progress_photos', 'visibility', 'private', 'photos default to private');
select has_function('public', 'get_public_progress_photos', array['text'], 'safe public photo function exists');
select has_function('public', 'is_progress_photo_public', array['text'], 'Storage public visibility helper exists');
select function_privs_are('public', 'get_public_progress_photos', array['text'], 'anon', array['EXECUTE'], 'anonymous users may request public photo metadata');
select results_eq('select public from storage.buckets where id = ''progress-photos''', array[false], 'progress photo bucket is private');
select results_eq('select file_size_limit from storage.buckets where id = ''progress-photos''', array[10485760::bigint], 'bucket limits uploads to 10 MB');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'progress_photo_insert_own'), 'Storage upload is owner-scoped');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'progress_photo_read_allowed'), 'Storage reads require ownership or explicit public visibility');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'progress_photo_delete_own'), 'Storage deletion is owner-scoped');

insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000001', 'photo-a@example.invalid'),
  ('80000000-0000-0000-0000-000000000002', 'photo-b@example.invalid');
insert into public.profiles(id, username, display_name) values
  ('80000000-0000-0000-0000-000000000001', 'photo_user_a', 'Photo A'),
  ('80000000-0000-0000-0000-000000000002', 'photo_user_b', 'Photo B');
insert into public.progress_photos(id, user_id, storage_path, photo_date, note, visibility) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002/private.webp', current_date, 'private note', 'private'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002/public.webp', current_date, 'public note', 'public');

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select results_eq('select count(*)::bigint from public.progress_photos where id = ''81000000-0000-0000-0000-000000000001''', array[0::bigint], 'A cannot read B private photo metadata');
select results_eq('select count(*)::bigint from public.progress_photos where id = ''81000000-0000-0000-0000-000000000002''', array[1::bigint], 'A can read B explicitly public photo metadata');
select results_eq(
  'delete from public.progress_photos where id = ''81000000-0000-0000-0000-000000000002'' returning id',
  array[]::uuid[],
  'A cannot delete B public photo metadata'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select results_eq('select count(*)::bigint from public.get_public_progress_photos(''photo_user_b'')', array[1::bigint], 'public RPC returns only explicit public photos');
select results_eq('select count(*)::bigint from public.progress_photos where visibility = ''private''', array[0::bigint], 'anonymous users cannot read private photo metadata');
select results_eq('select count(*)::bigint from public.progress_photos where visibility = ''public''', array[1::bigint], 'anonymous users can read public photo metadata');
select results_eq('select count(*)::bigint from public.get_public_progress_photos(''missing_user'')', array[0::bigint], 'unknown users return no photos');

select * from finish();
rollback;

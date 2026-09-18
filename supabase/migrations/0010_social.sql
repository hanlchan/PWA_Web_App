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
using (follower_id = auth.uid() or following_id = auth.uid());
create policy follows_insert_self on public.follows for insert to authenticated
with check (follower_id = auth.uid() and following_id <> auth.uid());
create policy follows_delete_self on public.follows for delete to authenticated
using (follower_id = auth.uid());
create policy checkin_likes_owner_select on public.checkin_likes for select to authenticated using (user_id = auth.uid());
create policy checkin_likes_owner_delete on public.checkin_likes for delete to authenticated using (user_id = auth.uid());
create policy notifications_owner_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy nudges_participant_select on public.nudges for select to authenticated using (actor_id = auth.uid() or target_id = auth.uid());

create or replace function public.search_public_users(p_query text)
returns table(id uuid, username text, display_name text, avatar_path text, is_following boolean)
language sql stable security definer set search_path = public, pg_catalog as $$
  select p.id, p.username::text, p.display_name, p.avatar_path,
    exists(select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id)
  from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid()
    and char_length(btrim(p_query)) between 2 and 30
    and (position(lower(btrim(p_query)) in lower(p.username::text)) > 0 or position(lower(btrim(p_query)) in lower(p.display_name)) > 0)
  order by case when lower(p.username::text) = lower(btrim(p_query)) then 0 else 1 end, p.username
  limit 20;
$$;

create or replace function public.toggle_follow(p_target_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare uid uuid := auth.uid();
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
  select f.following_id from public.follows f where f.follower_id = auth.uid()
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
  'liked_by_me', exists(select 1 from public.checkin_likes l where l.checkin_id = d.checkin_id and l.user_id = auth.uid()),
  'can_nudge', exists(select 1 from public.plan_occurrences o join public.profile_settings s on s.user_id = o.user_id where o.user_id = p.id and o.scheduled_date = (now() at time zone s.timezone)::date and o.status = 'pending')
) order by d.completed_at desc), '[]'::jsonb)
from days d join public.profiles p on p.id = d.user_id;
$$;

create or replace function public.toggle_checkin_like(p_checkin_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
declare uid uuid := auth.uid(); owner_id uuid;
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
declare uid uuid := auth.uid(); target_today date; result uuid;
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
from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit greatest(1, least(coalesce(p_limit,30),50))) n
left join public.profiles p on p.id = n.actor_id;
$$;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public, pg_catalog as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.search_public_users(text), public.toggle_follow(uuid), public.get_following_feed(integer), public.toggle_checkin_like(uuid), public.send_nudge(uuid), public.get_my_notifications(integer), public.mark_notifications_read() from public, anon;
grant execute on function public.search_public_users(text), public.toggle_follow(uuid), public.get_following_feed(integer), public.toggle_checkin_like(uuid), public.send_nudge(uuid), public.get_my_notifications(integer), public.mark_notifications_read() to authenticated;

create or replace function public.get_today_dashboard() returns jsonb
language sql stable security definer set search_path=public,pg_catalog as $$
with context as (
  select auth.uid() uid,s.timezone,(now() at time zone s.timezone)::date today from public.profile_settings s where s.user_id=auth.uid()
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

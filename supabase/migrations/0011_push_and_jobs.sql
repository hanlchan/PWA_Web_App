create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

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
using(user_id = auth.uid()) with check(user_id = auth.uid());

create unique index notifications_workout_occurrence_unique
on public.notifications(user_id, ((data->>'occurrence_id')))
where type = 'workout_reminder' and data ? 'occurrence_id';

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare uid uuid:=auth.uid(); result uuid;
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
declare uid uuid:=auth.uid();
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

-- A browser Push endpoint can be registered by only one account at a time.
-- There were no rows in public.push_subscriptions before this migration.
-- Rollback: drop index public.push_subscriptions_endpoint_key, then restore the
-- save_push_subscription definition from the initial schema migration.
create unique index push_subscriptions_endpoint_key
on public.push_subscriptions (endpoint);

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  uid uuid := auth.uid()::uuid;
  previous_uid uuid;
  result uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(p_endpoint) not between 20 and 4096
    or char_length(p_p256dh) not between 20 and 512
    or char_length(p_auth) not between 8 and 256
  then raise exception 'invalid subscription' using errcode='22023'; end if;

  -- Serialize registrations of this endpoint, including the first insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_endpoint)::bigint);
  select user_id into previous_uid
    from public.push_subscriptions where endpoint = p_endpoint;

  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  values(uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500))
  on conflict(endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
  returning id into result;

  update public.profile_settings set push_enabled = true where user_id = uid;
  if previous_uid is not null and previous_uid <> uid then
    update public.profile_settings
      set push_enabled = false
      where user_id = previous_uid
        and not exists (
          select 1 from public.push_subscriptions where user_id = previous_uid
        );
  end if;
  return result;
end; $$;

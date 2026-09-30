-- Cross-account transfer requires possession of the existing browser
-- subscription's auth secret and P-256 DH key, not just its endpoint URL.
-- This tightens the previous migration without changing table data.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  uid uuid := auth.uid()::uuid;
  previous_uid uuid;
  previous_p256dh text;
  previous_auth text;
  result uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(p_endpoint) not between 20 and 4096
    or char_length(p_p256dh) not between 20 and 512
    or char_length(p_auth) not between 8 and 256
  then raise exception 'invalid subscription' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_endpoint)::bigint);
  select user_id, p256dh, auth
    into previous_uid, previous_p256dh, previous_auth
    from public.push_subscriptions where endpoint = p_endpoint for update;
  if previous_uid is not null and previous_uid <> uid
    and (previous_p256dh is distinct from p_p256dh
      or previous_auth is distinct from p_auth)
  then raise exception 'subscription ownership proof mismatch' using errcode='42501'; end if;

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

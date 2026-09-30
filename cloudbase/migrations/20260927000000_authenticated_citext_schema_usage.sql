-- PostgREST resolves complete_onboarding(extensions.citext, ...) as the
-- authenticated role. Schema USAGE is required even when EXECUTE on the
-- public RPC and USAGE on the citext type have already been granted.
-- This grants no access to business tables and does not change RLS.
grant usage on schema extensions to authenticated;

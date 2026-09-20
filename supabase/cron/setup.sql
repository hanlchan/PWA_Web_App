-- Run only after migrations and Edge Function deployment.
-- Create these Vault secrets in the Supabase SQL editor first. Edge Functions
-- authenticate with x-cron-secret, so no public API key is stored in Vault:
-- select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('A_LONG_RANDOM_CRON_SECRET', 'workout_cron_secret');

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname in ('send-workout-reminders', 'generate-workout-occurrences')
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule('send-workout-reminders','* * * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/send-workout-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='workout_cron_secret')
    ), body := '{}'::jsonb, timeout_milliseconds := 10000
  );
$$);

select cron.schedule('generate-workout-occurrences','15 2 * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/generate-occurrences',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='workout_cron_secret')
    ), body := '{}'::jsonb, timeout_milliseconds := 10000
  );
$$);

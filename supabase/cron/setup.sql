-- Run only after migrations and Edge Function deployment.
-- Create these Vault secrets in the Supabase SQL editor first:
-- select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_PUBLISHABLE_KEY', 'publishable_key');
-- select vault.create_secret('A_LONG_RANDOM_CRON_SECRET', 'workout_cron_secret');

select cron.schedule('send-workout-reminders','* * * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/send-workout-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='publishable_key'),
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='workout_cron_secret')
    ), body := '{}'::jsonb, timeout_milliseconds := 10000
  );
$$);

select cron.schedule('generate-workout-occurrences','15 2 * * *',$$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/generate-occurrences',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='publishable_key'),
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='workout_cron_secret')
    ), body := '{}'::jsonb, timeout_milliseconds := 10000
  );
$$);

-- Run the `cron` Edge Function every 5 minutes (offline devices, expired commands, daily market sync, price alerts).
-- The shared secret lives in Supabase Vault as 'cron_secret' (created outside git) and in the function's CRON_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('agriaqua-sweep', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://yrlfpbbbvjfguoratasn.supabase.co/functions/v1/cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

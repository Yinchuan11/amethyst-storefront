-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to check Bitcoin payments every 5 minutes
SELECT cron.schedule(
  'bitcoin-payment-monitor',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qdkmsyncdbfmldfzojac.supabase.co/functions/v1/bitcoin-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFka21zeW5jZGJmbWxkZnpvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMTk5OTUsImV4cCI6MjA2ODc5NTk5NX0.q_mkkOZDy6qN-WwAnOwKQXuxpjQuPCbW4haoGP3NNao"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
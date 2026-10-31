BEGIN;

ALTER TABLE integration_request_logs
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS request_content_type text,
  ADD COLUMN IF NOT EXISTS request_content_length integer,
  ADD COLUMN IF NOT EXISTS response_content_type text,
  ADD COLUMN IF NOT EXISTS response_content_length integer,
  ADD COLUMN IF NOT EXISTS response_summary jsonb;

COMMIT;

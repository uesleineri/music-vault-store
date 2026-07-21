-- Drive's per-permission expirationTime is silently ignored on this
-- project's personal (non-Workspace) Google account, so a buyer's real
-- Drive access never actually expires on its own even though the app's
-- download token does. Tracks when revoke-expired-shares has explicitly
-- pulled the Drive permission for a sale, so the hourly job below doesn't
-- redo work or re-hit the Drive API for sales it already handled.
ALTER TABLE public.sales ADD COLUMN drive_access_revoked_at TIMESTAMP WITH TIME ZONE;

-- Scopes the job's query to exactly the rows it needs: paid, expired, not
-- yet revoked.
CREATE INDEX idx_sales_pending_drive_revocation ON public.sales (download_expires_at)
  WHERE payment_status = 'paid' AND drive_access_revoked_at IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Hourly is frequent enough relative to the 48h download window without
-- calling the Drive API constantly. Uses the anon key, same as Supabase's
-- own documented pattern for scheduling Edge Functions - it's the same
-- public key already shipped in the site's bundled JS, not a secret, so
-- there's nothing new exposed by it appearing here.
SELECT cron.schedule(
  'revoke-expired-drive-shares',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nhbuivrsbiivimeoyqqr.supabase.co/functions/v1/revoke-expired-shares',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_5jW53gFyTSjk9P7ECwrmiQ_Sod395Aw',
      'Authorization', 'Bearer sb_publishable_5jW53gFyTSjk9P7ECwrmiQ_Sod395Aw'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

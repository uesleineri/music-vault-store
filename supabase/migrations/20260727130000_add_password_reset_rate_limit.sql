-- Tracks password-reset/set-password-link requests so request-password-reset
-- can throttle abuse (anyone typing an arbitrary email to spam that inbox
-- with reset links) - service_role only, no public policy at all, matching
-- the audit_logs pattern: this table is never touched directly by a client,
-- only by the Edge Function that enforces the limit.
CREATE TABLE public.password_reset_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_attempts_email_time ON public.password_reset_attempts (lower(email), created_at);
CREATE INDEX idx_password_reset_attempts_ip_time ON public.password_reset_attempts (ip_address, created_at);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies at all.

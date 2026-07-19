-- Shopping cart: lets one PIX payment cover several sales rows (one row per
-- multitrack/bundle, same as before) instead of exactly one. All rows created
-- together share a checkout_group_id, which becomes the Asaas
-- externalReference - the webhook/verify-payment/get-download flows update or
-- read every row in the group instead of assuming a 1:1 sale<->payment.
ALTER TABLE public.sales ADD COLUMN checkout_group_id uuid;
UPDATE public.sales SET checkout_group_id = gen_random_uuid() WHERE checkout_group_id IS NULL;
ALTER TABLE public.sales ALTER COLUMN checkout_group_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN checkout_group_id SET DEFAULT gen_random_uuid();
CREATE INDEX idx_sales_checkout_group_id ON public.sales(checkout_group_id);

-- download_token used to be one-per-sale (UNIQUE). A cart checkout now shares
-- one download_token across every row in its group, so it can no longer be
-- globally unique - drop the constraint and keep a plain index for lookups.
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_download_token_key;
CREATE INDEX idx_sales_download_token ON public.sales(download_token);

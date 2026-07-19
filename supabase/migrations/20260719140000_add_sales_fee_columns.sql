-- Financial module: capture the Asaas fee and net value per sale so the admin
-- panel can show gross revenue, fees and net profit without calling Asaas again.
-- Nullable because historical sales (paid before this column existed) never had
-- this data captured; the financial dashboard treats null as "unknown", not zero.
ALTER TABLE public.sales ADD COLUMN asaas_fee numeric;
ALTER TABLE public.sales ADD COLUMN net_amount numeric;

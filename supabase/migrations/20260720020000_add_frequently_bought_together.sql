-- "Você também pode gostar" needs a "frequently bought together" signal from
-- `sales`, but that table is admin-only to SELECT (buyer emails, amounts).
-- This function returns just multitrack_id + a count - nothing sensitive -
-- via SECURITY DEFINER so the public storefront can call it without a
-- broader (and unsafe) read grant on `sales` itself.
CREATE OR REPLACE FUNCTION public.get_frequently_bought_with(p_multitrack_id uuid, p_limit int DEFAULT 4)
RETURNS TABLE(multitrack_id uuid, purchase_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s2.multitrack_id, count(*) AS purchase_count
  FROM public.sales s1
  JOIN public.sales s2
    ON s2.checkout_group_id = s1.checkout_group_id
    AND s2.multitrack_id IS NOT NULL
    AND s2.multitrack_id != p_multitrack_id
  WHERE s1.multitrack_id = p_multitrack_id
    AND s1.payment_status = 'paid'
    AND s2.payment_status = 'paid'
  GROUP BY s2.multitrack_id
  ORDER BY purchase_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_frequently_bought_with(uuid, int) TO anon, authenticated;

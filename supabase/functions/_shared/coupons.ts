// Shared by validate-coupon (live preview on the checkout page) and
// create-payment (the authoritative, final check before charging). Both must
// agree on the math, so this lives in one place instead of being duplicated.
export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: any;
  discountAmount?: number;
  finalPrice?: number;
}

export async function validateCoupon(
  supabase: any,
  code: string,
  price: number
): Promise<CouponValidationResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { valid: false, error: "Informe um código de cupom" };

  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error) throw error;
  if (!coupon) return { valid: false, error: "Cupom não encontrado" };
  if (!coupon.is_active) return { valid: false, error: "Cupom inativo" };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, error: "Cupom expirado" };
  }
  if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
    return { valid: false, error: "Cupom esgotado" };
  }
  if (coupon.min_purchase_value && price < Number(coupon.min_purchase_value)) {
    return {
      valid: false,
      error: `Este cupom exige compra mínima de R$ ${Number(coupon.min_purchase_value).toFixed(2)}`,
    };
  }

  const rawDiscount =
    coupon.discount_type === "percentage"
      ? price * (Number(coupon.discount_value) / 100)
      : Number(coupon.discount_value);
  const discountAmount = Math.round(Math.min(rawDiscount, price) * 100) / 100;
  const finalPrice = Math.round((price - discountAmount) * 100) / 100;

  return { valid: true, coupon, discountAmount, finalPrice };
}

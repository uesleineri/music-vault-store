import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateCoupon } from "../_shared/coupons.ts";
import { notifyAdmins } from "../_shared/admin-notifications.ts";

interface CartItemRequest {
  // Exactly one of these two must be sent per item.
  multitrack_id?: string;
  bundle_id?: string;
}

interface CreatePaymentRequest {
  items: CartItemRequest[];
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_phone: string;
  coupon_code?: string;
  // "pix" generates a QR code; "credit_card" requires a token already
  // generated client-side via the Mercado Pago SDK (the card number itself
  // never reaches this backend).
  payment_method: "pix" | "credit_card";
  card_token?: string;
  card_payment_method_id?: string; // e.g. "master", "visa" - returned by the Card Payment Brick alongside the token
  card_installments?: number;
}

interface ResolvedItem {
  multitrack_id: string | null;
  bundle_id: string | null;
  name: string;
  price: number;
}

// Masks PII (CPF, phone, email) before it ever reaches the Edge Function logs.
function redactPII(obj: Record<string, any>): Record<string, any> {
  const maskTail = (value: unknown) =>
    typeof value === "string" && value.length > 2 ? `${value.slice(0, 2)}***${value.slice(-2)}` : "***";
  const redacted: Record<string, any> = { ...obj };
  for (const key of ["number", "mobilePhone", "phone", "email", "token"]) {
    if (key in redacted) redacted[key] = maskTail(redacted[key]);
  }
  if (redacted.identification && typeof redacted.identification === "object") {
    redacted.identification = { ...redacted.identification, number: maskTail(redacted.identification.number) };
  }
  if (redacted.payer && typeof redacted.payer === "object") {
    redacted.payer = redactPII(redacted.payer);
  }
  return redacted;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      items,
      buyer_name,
      buyer_email,
      buyer_cpf,
      buyer_phone,
      coupon_code,
      payment_method,
      card_token,
      card_payment_method_id,
      card_installments,
    }: CreatePaymentRequest = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "O carrinho está vazio" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (items.some((item) => !item.multitrack_id === !item.bundle_id)) {
      return new Response(
        JSON.stringify({ error: "Cada item precisa ter exatamente um de multitrack_id ou bundle_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (payment_method !== "pix" && payment_method !== "credit_card") {
      return new Response(
        JSON.stringify({ error: "Forma de pagamento inválida" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (payment_method === "credit_card" && (!card_token || !card_payment_method_id)) {
      return new Response(
        JSON.stringify({ error: "Dados do cartão incompletos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    // Without this, the same product sent twice in `items` would create two
    // sales rows and double the charge - the cart UI already prevents this,
    // but a tampered request could still send it.
    const itemKeys = items.map((item) => item.multitrack_id ?? item.bundle_id);
    if (new Set(itemKeys).size !== itemKeys.length) {
      return new Response(
        JSON.stringify({ error: "O carrinho tem um item duplicado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Never trust prices from the client - look up the real, current price of
    // every item so a tampered request can't buy anything for less.
    const multitrackIds = items.map((i) => i.multitrack_id).filter((id): id is string => !!id);
    const bundleIds = items.map((i) => i.bundle_id).filter((id): id is string => !!id);

    const [{ data: multitracks, error: mtError }, { data: bundles, error: bundleError }] = await Promise.all([
      multitrackIds.length > 0
        ? supabase.from("multitracks").select("id, artist_name, song_name, price, is_active").in("id", multitrackIds)
        : Promise.resolve({ data: [], error: null }),
      bundleIds.length > 0
        ? supabase.from("bundles").select("id, name, price, is_active").in("id", bundleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (mtError) throw mtError;
    if (bundleError) throw bundleError;

    const multitrackById = new Map((multitracks ?? []).map((m: any) => [m.id, m]));
    const bundleById = new Map((bundles ?? []).map((b: any) => [b.id, b]));

    // A bundle can still look purchasable itself while one of the songs
    // inside it was individually deactivated (e.g. a takedown) - check every
    // component, not just the bundle row.
    let bundleIdsWithInactiveSong = new Set<string>();
    if (bundleIds.length > 0) {
      const { data: bundleItems, error: bundleItemsError } = await supabase
        .from("bundle_items")
        .select("bundle_id, multitrack:multitracks(is_active)")
        .in("bundle_id", bundleIds);
      if (bundleItemsError) throw bundleItemsError;
      bundleIdsWithInactiveSong = new Set(
        (bundleItems ?? [])
          .filter((bi: any) => !bi.multitrack?.is_active)
          .map((bi: any) => bi.bundle_id)
      );
    }

    const resolvedItems: ResolvedItem[] = [];
    for (const item of items) {
      if (item.multitrack_id) {
        const mt = multitrackById.get(item.multitrack_id);
        if (!mt || !mt.is_active) {
          return new Response(
            JSON.stringify({ error: "Um dos produtos do carrinho não está mais disponível" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        resolvedItems.push({
          multitrack_id: mt.id,
          bundle_id: null,
          name: `${mt.artist_name} - ${mt.song_name}`,
          price: Number(mt.price),
        });
      } else {
        const bundle = bundleById.get(item.bundle_id);
        if (!bundle || !bundle.is_active || bundleIdsWithInactiveSong.has(item.bundle_id)) {
          return new Response(
            JSON.stringify({ error: "Um dos kits do carrinho não está mais disponível" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        resolvedItems.push({
          multitrack_id: null,
          bundle_id: bundle.id,
          name: bundle.name,
          price: Number(bundle.price),
        });
      }
    }

    const totalPrice = resolvedItems.reduce((sum, item) => sum + item.price, 0);
    let totalAmount = totalPrice;
    let totalDiscount = 0;
    let couponId: string | null = null;

    // Re-validate the coupon here too (never trust the discount the checkout
    // page previewed via validate-coupon) and reserve it atomically so two
    // simultaneous checkouts can't both use the last redemption.
    if (coupon_code) {
      const couponResult = await validateCoupon(supabase, coupon_code, totalPrice);
      if (!couponResult.valid) {
        return new Response(
          JSON.stringify({ error: couponResult.error || "Cupom inválido" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: consumed, error: consumeError } = await supabase.rpc("consume_coupon", {
        p_coupon_id: couponResult.coupon.id,
      });
      if (consumeError) throw consumeError;
      if (!consumed) {
        return new Response(
          JSON.stringify({ error: "Este cupom acabou de esgotar. Tente novamente sem ele." }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      totalAmount = couponResult.finalPrice!;
      totalDiscount = couponResult.discountAmount!;
      couponId = couponResult.coupon.id;
    }

    // Conservative safety floors, not gateway-mandated minimums - Pix
    // confirmed working in production down to R$1. Card's R$5 floor is just
    // a sane default; a card decline with status_detail "insufficient_amount"
    // means the *card itself* lacks available funds/limit, not that the
    // charge was too small (verified against Mercado Pago's own docs after
    // initially misreading it as an amount-minimum rule).
    const minAmount = payment_method === "credit_card" ? 5 : 1;
    if (totalAmount > 0 && totalAmount < minAmount) {
      return new Response(
        JSON.stringify({ error: `O total da compra (R$ ${totalAmount.toFixed(2).replace(".", ",")}) precisa ser de pelo menos R$ ${minAmount.toFixed(2).replace(".", ",")} para pagamento com ${payment_method === "credit_card" ? "cartão" : "PIX"}.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Split the coupon discount across items proportionally to their price,
    // so each sales row still reports its own real amount/discount - the last
    // item absorbs the rounding remainder so the split sums exactly.
    let allocatedDiscount = 0;
    const itemsWithAmount = resolvedItems.map((item, index) => {
      // totalPrice is 0 only if every item is itself priced at 0 - nothing to
      // split (and item.price / totalPrice would be a division by zero).
      if (totalPrice === 0) {
        return { ...item, discount: 0, amount: 0 };
      }
      let discount: number;
      if (index === resolvedItems.length - 1) {
        discount = Math.round((totalDiscount - allocatedDiscount) * 100) / 100;
      } else {
        discount = Math.round((totalDiscount * (item.price / totalPrice)) * 100) / 100;
        allocatedDiscount += discount;
      }
      return { ...item, discount, amount: Math.round((item.price - discount) * 100) / 100 };
    });

    const checkoutGroupId = crypto.randomUUID();
    const downloadToken = crypto.randomUUID();
    const downloadExpiresAt = new Date();
    downloadExpiresAt.setHours(downloadExpiresAt.getHours() + 48); // 48 hours expiration

    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .insert(
        itemsWithAmount.map((item) => ({
          checkout_group_id: checkoutGroupId,
          multitrack_id: item.multitrack_id,
          bundle_id: item.bundle_id,
          buyer_email,
          amount: item.amount,
          coupon_id: couponId,
          discount_amount: item.discount,
          payment_status: "pending",
          download_token: downloadToken,
          download_expires_at: downloadExpiresAt.toISOString(),
        }))
      )
      .select();

    if (salesError) throw salesError;

    const amountStr = totalAmount.toFixed(2);
    const payments =
      payment_method === "pix"
        ? [
            {
              amount: amountStr,
              payment_method: { id: "pix", type: "bank_transfer" },
              // Same D+1-ish window the Asaas flow used - Mercado Pago's
              // default is 24h if omitted, this makes it explicit.
              expiration_time: "P1D",
            },
          ]
        : [
            {
              amount: amountStr,
              payment_method: {
                id: card_payment_method_id,
                type: "credit_card",
                token: card_token,
                installments: card_installments && card_installments > 0 ? card_installments : 1,
              },
            },
          ];

    const orderBody = {
      type: "online",
      total_amount: amountStr,
      external_reference: checkoutGroupId,
      processing_mode: "automatic",
      transactions: { payments },
      payer: {
        email: buyer_email,
        first_name: buyer_name,
        identification: { type: "CPF", number: buyer_cpf },
      },
    };

    console.log("Creating Mercado Pago order with body:", JSON.stringify(redactPII(orderBody)));

    const orderResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        // One key per checkout attempt (the group id) - retrying the same
        // request never creates a second charge.
        "X-Idempotency-Key": checkoutGroupId,
      },
      body: JSON.stringify(orderBody),
    });

    const order = await orderResponse.json();
    console.log("Mercado Pago order response:", JSON.stringify(redactPII(order)));

    const orderPayment = order?.transactions?.payments?.[0];
    if (!order?.id || !orderPayment?.id) {
      console.error("Order creation failed:", redactPII(order));
      throw new Error(`Failed to create order: ${JSON.stringify(redactPII(order))}`);
    }

    // Update every row in the group with the same order/payment id.
    await supabase
      .from("sales")
      .update({ payment_id: order.id })
      .eq("checkout_group_id", checkoutGroupId);

    await notifyAdmins(supabase, "new_sale", sales, buyer_email);

    if (payment_method === "pix") {
      return new Response(
        JSON.stringify({
          success: true,
          sale_id: checkoutGroupId,
          order_id: order.id,
          payment_id: orderPayment.id,
          amount: totalAmount,
          discount_amount: totalDiscount,
          payment_method: "pix",
          pix_qr_code_image: orderPayment.payment_method?.qr_code_base64,
          pix_copy_paste: orderPayment.payment_method?.qr_code,
          pix_expiration: orderPayment.date_of_expiration ?? null,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: checkoutGroupId,
        order_id: order.id,
        payment_id: orderPayment.id,
        amount: totalAmount,
        discount_amount: totalDiscount,
        payment_method: "credit_card",
        status: orderPayment.status,
        status_detail: orderPayment.status_detail,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in create-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

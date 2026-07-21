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
  for (const key of ["cpfCnpj", "mobilePhone", "phone", "email"]) {
    if (key in redacted) redacted[key] = maskTail(redacted[key]);
  }
  if (Array.isArray(redacted.data)) {
    redacted.data = redacted.data.map((item: any) => (item && typeof item === "object" ? redactPII(item) : item));
  }
  return redacted;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { items, buyer_name, buyer_email, buyer_cpf, buyer_phone, coupon_code }: CreatePaymentRequest = await req.json();

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

    // Asaas rejects any PIX charge under R$5 outright - catch it here with a
    // clear message instead of surfacing Asaas' raw API error to the buyer.
    if (totalAmount > 0 && totalAmount < 5) {
      return new Response(
        JSON.stringify({ error: `O total da compra (R$ ${totalAmount.toFixed(2).replace(".", ",")}) precisa ser de pelo menos R$ 5,00 - é o mínimo aceito para pagamento via PIX.` }),
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

    // Create Asaas customer (or find existing)
    const customerBody = {
      email: buyer_email,
      name: buyer_name,
      cpfCnpj: buyer_cpf,
      mobilePhone: buyer_phone,
    };

    console.log("Creating customer with body:", JSON.stringify(redactPII(customerBody)));

    const customerResponse = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify(customerBody),
    });

    let customer;
    const customerResponseData = await customerResponse.json();
    console.log("Customer response status:", customerResponse.status);
    console.log("Customer response data:", JSON.stringify(redactPII(customerResponseData)));

    if (customerResponse.status === 409 || customerResponseData.errors?.some((e: any) => e.code === "invalid_cpfCnpj_alreadyInUse")) {
      // Customer already exists, fetch by CPF
      console.log("Customer exists, searching by CPF...");
      const searchResponse = await fetch(
        `https://api.asaas.com/v3/customers?cpfCnpj=${buyer_cpf}`,
        {
          headers: { "access_token": asaasApiKey },
        }
      );
      const searchData = await searchResponse.json();
      console.log("Search response:", JSON.stringify(redactPII(searchData)));
      customer = searchData.data?.[0];
    } else if (customerResponseData.id) {
      customer = customerResponseData;
    } else {
      console.error("Customer creation failed:", redactPII(customerResponseData));
      throw new Error(`Failed to create customer: ${JSON.stringify(customerResponseData)}`);
    }

    if (!customer?.id) {
      throw new Error("Failed to create/find customer");
    }

    // Create Asaas PIX payment - one payment for the whole cart.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const description =
      resolvedItems.length === 1
        ? resolvedItems[0].name
        : `${resolvedItems[0].name} e mais ${resolvedItems.length - 1} item(ns)`;

    const paymentBody = {
      customer: customer.id,
      billingType: "PIX", // PIX only
      value: totalAmount,
      dueDate: dueDate.toISOString().split("T")[0],
      description,
      externalReference: checkoutGroupId,
    };

    console.log("Creating PIX payment with body:", JSON.stringify(paymentBody));

    const paymentResponse = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await paymentResponse.json();
    console.log("Asaas payment response:", JSON.stringify(payment));

    if (!payment?.id) {
      console.error("Payment creation failed:", payment);
      throw new Error(`Failed to create payment: ${JSON.stringify(payment)}`);
    }

    // Update every row in the group with the same payment ID
    await supabase
      .from("sales")
      .update({ payment_id: payment.id })
      .eq("checkout_group_id", checkoutGroupId);

    await notifyAdmins(supabase, "new_sale", sales, buyer_email);

    // Get PIX QR Code
    const pixResponse = await fetch(
      `https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`,
      {
        headers: { "access_token": asaasApiKey },
      }
    );

    const pixData = await pixResponse.json();
    console.log("PIX QR Code response:", JSON.stringify(pixData));

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: checkoutGroupId,
        payment_id: payment.id,
        amount: totalAmount,
        discount_amount: totalDiscount,
        pix_qr_code_image: pixData.encodedImage, // Base64 image
        pix_copy_paste: pixData.payload, // Copy-paste code
        pix_expiration: pixData.expirationDate,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
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

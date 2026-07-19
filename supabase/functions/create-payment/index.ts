import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateCoupon } from "../_shared/coupons.ts";

interface CreatePaymentRequest {
  multitrack_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_phone: string;
  coupon_code?: string;
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

    const { multitrack_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, coupon_code }: CreatePaymentRequest = await req.json();

    // Never trust a price from the client - look up the real, current price
    // for this multitrack so a tampered request can't buy it for less.
    const { data: multitrack, error: multitrackError } = await supabase
      .from("multitracks")
      .select("artist_name, song_name, price, is_active")
      .eq("id", multitrack_id)
      .single();

    if (multitrackError || !multitrack || !multitrack.is_active) {
      return new Response(
        JSON.stringify({ error: "Produto não encontrado ou indisponível" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let amount = multitrack.price;
    let discountAmount = 0;
    let couponId: string | null = null;
    const multitrack_name = `${multitrack.artist_name} - ${multitrack.song_name}`;

    // Re-validate the coupon here too (never trust the discount the checkout
    // page previewed via validate-coupon) and reserve it atomically so two
    // simultaneous checkouts can't both use the last redemption.
    if (coupon_code) {
      const couponResult = await validateCoupon(supabase, coupon_code, multitrack.price);
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

      amount = couponResult.finalPrice!;
      discountAmount = couponResult.discountAmount!;
      couponId = couponResult.coupon.id;
    }

    // Generate unique download token
    const downloadToken = crypto.randomUUID();
    const downloadExpiresAt = new Date();
    downloadExpiresAt.setHours(downloadExpiresAt.getHours() + 48); // 48 hours expiration

    // Create sale record first
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        multitrack_id,
        buyer_email,
        amount,
        coupon_id: couponId,
        discount_amount: discountAmount,
        payment_status: "pending",
        download_token: downloadToken,
        download_expires_at: downloadExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (saleError) throw saleError;

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

    // Create Asaas PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const paymentBody = {
      customer: customer.id,
      billingType: "PIX", // PIX only
      value: amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Multitrack: ${multitrack_name}`,
      externalReference: sale.id,
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

    // Update sale with payment ID
    await supabase
      .from("sales")
      .update({ payment_id: payment.id })
      .eq("id", sale.id);

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
        sale_id: sale.id,
        payment_id: payment.id,
        amount,
        discount_amount: discountAmount,
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
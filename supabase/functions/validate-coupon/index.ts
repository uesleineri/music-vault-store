import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateCoupon } from "../_shared/coupons.ts";

// Public: lets the checkout page preview a discount before submitting the
// order. This is a preview only - create-payment independently re-validates
// and re-computes the price server-side, so a tampered client can't use this
// endpoint to trick the actual charge.
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, multitrack_id, bundle_id } = await req.json();
    if (!code || (!multitrack_id && !bundle_id)) {
      return new Response(JSON.stringify({ valid: false, error: "code e multitrack_id ou bundle_id são obrigatórios" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let price: number;
    if (multitrack_id) {
      const { data: multitrack, error: mtError } = await supabase
        .from("multitracks")
        .select("price, is_active")
        .eq("id", multitrack_id)
        .single();

      if (mtError || !multitrack || !multitrack.is_active) {
        return new Response(JSON.stringify({ valid: false, error: "Produto não encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      price = multitrack.price;
    } else {
      const { data: bundle, error: bundleError } = await supabase
        .from("bundles")
        .select("price, is_active")
        .eq("id", bundle_id)
        .single();

      if (bundleError || !bundle || !bundle.is_active) {
        return new Response(JSON.stringify({ valid: false, error: "Kit não encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      price = bundle.price;
    }

    const result = await validateCoupon(supabase, code, price);

    // Never leak internal coupon fields (id, times_used, etc.) to the client.
    return new Response(
      JSON.stringify({
        valid: result.valid,
        error: result.error,
        discount_amount: result.discountAmount,
        final_price: result.finalPrice,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in validate-coupon:", error);
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

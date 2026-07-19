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

    const { code, items } = await req.json();
    if (!code || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ valid: false, error: "code e items são obrigatórios" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const multitrackIds = items.map((i: any) => i.multitrack_id).filter(Boolean);
    const bundleIds = items.map((i: any) => i.bundle_id).filter(Boolean);

    const [{ data: multitracks, error: mtError }, { data: bundles, error: bundleError }] = await Promise.all([
      multitrackIds.length > 0
        ? supabase.from("multitracks").select("id, price, is_active").in("id", multitrackIds)
        : Promise.resolve({ data: [], error: null }),
      bundleIds.length > 0
        ? supabase.from("bundles").select("id, price, is_active").in("id", bundleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (mtError) throw mtError;
    if (bundleError) throw bundleError;

    const multitrackById = new Map((multitracks ?? []).map((m: any) => [m.id, m]));
    const bundleById = new Map((bundles ?? []).map((b: any) => [b.id, b]));

    let price = 0;
    for (const item of items) {
      const product = item.multitrack_id ? multitrackById.get(item.multitrack_id) : bundleById.get(item.bundle_id);
      if (!product || !product.is_active) {
        return new Response(JSON.stringify({ valid: false, error: "Um dos itens do carrinho não foi encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      price += Number(product.price);
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

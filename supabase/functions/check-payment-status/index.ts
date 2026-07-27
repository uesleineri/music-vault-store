import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Lets the checkout page (anonymous, no session) poll whether its own
// checkout group got paid, without needing sales-table read access - the
// customer isn't logged in yet at this point, so neither of the "Admins can
// view all sales" nor "Customers can view own sales" RLS policies apply.
// Same trust model as download_token/get-download: checkout_group_id is an
// unguessable UUID the browser already holds (returned as sale_id by
// create-payment), so handing back just a status + download_token for that
// one group leaks nothing to anyone who doesn't already have it.
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { checkout_group_id } = await req.json();
    if (!checkout_group_id) {
      return new Response(JSON.stringify({ error: "checkout_group_id é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: sales, error } = await supabase
      .from("sales")
      .select("payment_status, download_token")
      .eq("checkout_group_id", checkout_group_id);
    if (error) throw error;

    if (!sales || sales.length === 0) {
      return new Response(JSON.stringify({ error: "Grupo de checkout não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allPaid = sales.every((s: any) => s.payment_status === "paid");
    const anyFailed = sales.some((s: any) => s.payment_status === "failed");
    const status = allPaid ? "paid" : anyFailed ? "failed" : "pending";

    return new Response(
      JSON.stringify({
        status,
        download_token: allPaid ? sales[0].download_token : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-payment-status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

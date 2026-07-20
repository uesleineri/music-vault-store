import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";
import { describeGroup } from "../_shared/checkout-group.ts";

// Admin-only: lets an admin manually mark a stuck pending sale as failed -
// e.g. a checkout whose Asaas payment was never actually created (rejected
// for being under the R$5 PIX minimum, or any other reason), so
// verify-payment has nothing to check and the row would sit "pending"
// forever otherwise.
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { sale_id } = await req.json();
    if (!sale_id) {
      return new Response(JSON.stringify({ error: "sale_id é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`*, multitrack:multitracks(*), bundle:bundles(*)`)
      .eq("id", sale_id)
      .single();

    if (saleError || !sale) {
      return new Response(JSON.stringify({ error: "Venda não encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (sale.payment_status === "paid") {
      return new Response(
        JSON.stringify({ error: "Esta venda já está paga e não pode ser cancelada." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cancel every row in the group, same as every other sale-state change.
    const { data: cancelledSales, error: updateError } = await supabase
      .from("sales")
      .update({ payment_status: "failed" })
      .eq("checkout_group_id", sale.checkout_group_id)
      .select(`*, multitrack:multitracks(*), bundle:bundles(*)`);

    if (updateError) throw updateError;

    await logAudit(supabase, req, {
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "sale.cancel",
      targetType: "sale",
      targetId: sale_id,
      targetLabel: `${describeGroup(cancelledSales)} (${sale.buyer_email})`,
      changes: { old: { payment_status: sale.payment_status }, new: { payment_status: "failed" } },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in cancel-sale:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

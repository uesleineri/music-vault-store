import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";
import { getSaleItems } from "../_shared/sale-items.ts";
import { distributeFee, describeGroup } from "../_shared/checkout-group.ts";

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

    // Verify the caller is a logged-in admin.
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

    if (!sale.payment_id) {
      return new Response(JSON.stringify({ error: "Venda sem payment_id da Asaas" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (sale.payment_status === "paid") {
      return new Response(
        JSON.stringify({ already_paid: true, sale }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    // Ask Asaas directly for the real payment status - never trust a manual click alone.
    const asaasResponse = await fetch(`https://api.asaas.com/v3/payments/${sale.payment_id}`, {
      headers: { access_token: asaasApiKey },
    });
    const asaasPayment = await asaasResponse.json();

    const confirmedStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
    if (!confirmedStatuses.includes(asaasPayment.status)) {
      return new Response(
        JSON.stringify({
          confirmed: false,
          asaas_status: asaasPayment.status,
          message: `Asaas reporta status "${asaasPayment.status}" - pagamento ainda não confirmado.`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update every sales row in this checkout group (one for a single-item
    // purchase, several for a cart) - they all share this same payment_id.
    const { data: updatedSales, error: updateError } = await supabase
      .from("sales")
      .update({ payment_status: "paid" })
      .eq("checkout_group_id", sale.checkout_group_id)
      .select(`*, multitrack:multitracks(*), bundle:bundles(*)`);

    if (updateError) throw updateError;

    // Same value/netValue fields Asaas sends on the webhook payload are also
    // present on this GET response - split them across the group here too,
    // since a sale can be confirmed via manual verification instead of the webhook.
    const grossValue = asaasPayment.value;
    const netValue = asaasPayment.netValue;
    if (typeof grossValue === "number" && typeof netValue === "number") {
      const feeUpdates = distributeFee(updatedSales, grossValue, netValue);
      await Promise.all(
        feeUpdates.map((update) =>
          supabase.from("sales").update({ asaas_fee: update.asaas_fee, net_amount: update.net_amount }).eq("id", update.id)
        )
      );
    }

    await logAudit(supabase, req, {
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "sale.verify_payment",
      targetType: "sale",
      targetId: sale_id,
      targetLabel: `${describeGroup(updatedSales)} (${sale.buyer_email})`,
      changes: { old: { payment_status: "pending" }, new: { payment_status: "paid", asaas_status: asaasPayment.status } },
    });

    try {
      const accessToken = await googleDrive.getAccessToken();
      const itemsBySale = await Promise.all(updatedSales.map((s: any) => getSaleItems(supabase, s)));
      const shares = updatedSales.flatMap((s: any, index: number) =>
        itemsBySale[index].map((item) => ({ item, buyerEmail: s.buyer_email, expiresAt: s.download_expires_at }))
      );
      await Promise.all(
        shares.map(({ item, buyerEmail, expiresAt }) => googleDrive.shareFileWithUser(item.file_url, buyerEmail, accessToken, expiresAt))
      );
    } catch (shareError) {
      console.error("Failed to share Drive file(s) after manual verification:", shareError);
    }

    return new Response(
      JSON.stringify({ confirmed: true, asaas_status: asaasPayment.status, sale: updatedSales.find((s: any) => s.id === sale_id) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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

    // Admin-only: resends to the buyer_email already on file for the sale,
    // never to an address supplied by the caller.
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
      .select(`*, multitrack:multitracks(*)`)
      .eq("id", sale_id)
      .eq("payment_status", "paid")
      .single();

    if (saleError || !sale) {
      return new Response(JSON.stringify({ error: "Venda paga não encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const driveFileId = sale.multitrack?.file_url;
    if (!driveFileId) {
      return new Response(JSON.stringify({ error: "Arquivo não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = await googleDrive.getAccessToken();
    await googleDrive.resendShareNotification(
      driveFileId,
      sale.buyer_email,
      accessToken,
      sale.download_expires_at
    );

    return new Response(
      JSON.stringify({ success: true, sent_to: sale.buyer_email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in resend-download:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

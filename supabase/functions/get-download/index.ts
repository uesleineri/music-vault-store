import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find sale by download token
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        *,
        multitrack:multitracks(*)
      `)
      .eq("download_token", token)
      .eq("payment_status", "paid")
      .single();

    if (saleError || !sale) {
      return new Response(
        JSON.stringify({ error: "Download não encontrado ou pagamento pendente" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if download link has expired
    if (sale.download_expires_at && new Date(sale.download_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Link de download expirado" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // file_url stores the Google Drive file ID for the multitrack
    const driveFileId = sale.multitrack?.file_url;
    if (!driveFileId) {
      return new Response(
        JSON.stringify({ error: "Arquivo não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const accessToken = await googleDrive.getAccessToken();

    // Make sure the buyer has read access even if the webhook's share call
    // hasn't landed yet (e.g. manual payment confirmation).
    try {
      await googleDrive.shareFileWithUser(driveFileId, sale.buyer_email, accessToken, sale.download_expires_at);
    } catch (shareError) {
      console.error("Non-fatal: failed to (re)share Drive file:", shareError);
    }

    const driveFile = await googleDrive.getFile(driveFileId, accessToken, "id,webViewLink");

    return new Response(
      JSON.stringify({
        download_url: driveFile.webViewLink,
        multitrack: {
          artist_name: sale.multitrack?.artist_name,
          song_name: sale.multitrack?.song_name,
          cover_url: sale.multitrack?.cover_url,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in get-download:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
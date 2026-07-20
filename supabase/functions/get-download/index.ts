import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSaleItems } from "../_shared/sale-items.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
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

    // A download_token is shared by every sales row created in the same
    // checkout (one for a single-item purchase, several for a cart).
    const { data: sales, error: saleError } = await supabase
      .from("sales")
      .select(`
        *,
        multitrack:multitracks(*),
        bundle:bundles(*)
      `)
      .eq("download_token", token)
      .eq("payment_status", "paid");

    if (saleError || !sales || sales.length === 0) {
      return new Response(
        JSON.stringify({ error: "Download não encontrado ou pagamento pendente" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Every row in the group was created together and shares the same expiry.
    const [firstSale] = sales;
    if (firstSale.download_expires_at && new Date(firstSale.download_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Link de download expirado" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const itemsBySale = await Promise.all(sales.map((sale: any) => getSaleItems(supabase, sale)));
    const items = itemsBySale.flat();
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Arquivo não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const accessToken = await googleDrive.getAccessToken();

    // For every file across every item in the group: make sure the buyer has
    // read access even if the webhook's share call hasn't landed yet, then
    // fetch its download link.
    const files = await Promise.all(
      items.map(async (item) => {
        try {
          await googleDrive.shareFileWithUser(item.file_url, firstSale.buyer_email, accessToken, firstSale.download_expires_at);
        } catch (shareError) {
          console.error("Non-fatal: failed to (re)share Drive file:", shareError);
        }
        const driveFile = await googleDrive.getFile(item.file_url, accessToken, "id,webViewLink");
        return {
          artist_name: item.artist_name,
          song_name: item.song_name,
          cover_url: item.cover_url,
          download_url: driveFile.webViewLink,
        };
      })
    );

    await supabase.from("funnel_events").insert({
      event_type: "download_completed",
      checkout_group_id: firstSale.checkout_group_id,
    });

    return new Response(
      JSON.stringify({
        product_name: sales.length === 1 ? (firstSale.bundle?.name ?? null) : null,
        files,
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
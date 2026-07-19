import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { logAudit } from "../_shared/audit.ts";
import { getSaleItems } from "../_shared/sale-items.ts";

const handler = async (req: Request): Promise<Response> => {
  try {
    // Asaas sends back the exact token configured in its webhook settings on
    // every request. Without this check, anyone who finds this URL could POST
    // a fake "PAYMENT_CONFIRMED" event and unlock any file for free.
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (!expectedToken || receivedToken !== expectedToken) {
      console.error("Rejected webhook call: invalid or missing asaas-access-token header");
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(payload));

    // Check if payment was confirmed
    if (payload.event === "PAYMENT_CONFIRMED" || payload.event === "PAYMENT_RECEIVED") {
      const externalReference = payload.payment?.externalReference;

      if (!externalReference) {
        console.log("No external reference, skipping");
        return new Response("OK", { status: 200 });
      }

      // Asaas' PIX payment object includes value/netValue (netValue = value minus
      // the Asaas fee) - capture it now since this payload won't be seen again.
      const grossValue = payload.payment?.value;
      const netValue = payload.payment?.netValue;
      const feeFields = typeof grossValue === "number" && typeof netValue === "number"
        ? { asaas_fee: grossValue - netValue, net_amount: netValue }
        : {};

      // Update sale status
      const { data: sale, error: updateError } = await supabase
        .from("sales")
        .update({ payment_status: "paid", ...feeFields })
        .eq("id", externalReference)
        .select(`
          *,
          multitrack:multitracks(*),
          bundle:bundles(*)
        `)
        .single();

      if (updateError) {
        console.error("Error updating sale:", updateError);
        throw updateError;
      }

      console.log("Sale updated to paid:", sale.id);

      await logAudit(supabase, req, {
        actorId: null,
        actorEmail: "webhook Asaas",
        action: "sale.payment_confirmed",
        targetType: "sale",
        targetId: sale.id,
        targetLabel: sale.multitrack
          ? `${sale.multitrack.artist_name} - ${sale.multitrack.song_name} (${sale.buyer_email})`
          : sale.bundle
          ? `${sale.bundle.name} (${sale.buyer_email})`
          : sale.buyer_email,
        changes: { old: { payment_status: "pending" }, new: { payment_status: "paid" } },
      });

      // Grant the buyer access to every file in the sale (one for a single
      // multitrack, several for a bundle) - Google sends its own "shared with
      // you" notification email automatically for each.
      try {
        const items = await getSaleItems(supabase, sale);
        const accessToken = await googleDrive.getAccessToken();
        for (const item of items) {
          await googleDrive.shareFileWithUser(item.file_url, sale.buyer_email, accessToken, sale.download_expires_at);
        }
        console.log(`Shared ${items.length} Drive file(s) with buyer:`, sale.buyer_email);
      } catch (shareError) {
        // Don't fail the webhook (Asaas would retry) if sharing hiccups -
        // get-download retries the share as a fallback when the buyer opens the link.
        console.error("Failed to share Drive file(s) with buyer:", shareError);
      }
    }

    if (payload.event === "PAYMENT_OVERDUE" || payload.event === "PAYMENT_DELETED") {
      const externalReference = payload.payment?.externalReference;
      
      if (externalReference) {
        const { data: failedSale } = await supabase
          .from("sales")
          .update({ payment_status: "failed" })
          .eq("id", externalReference)
          .select(`*, multitrack:multitracks(*), bundle:bundles(*)`)
          .single();

        await logAudit(supabase, req, {
          actorId: null,
          actorEmail: "webhook Asaas",
          action: "sale.payment_failed",
          targetType: "sale",
          targetId: externalReference,
          targetLabel: failedSale?.multitrack
            ? `${failedSale.multitrack.artist_name} - ${failedSale.multitrack.song_name} (${failedSale.buyer_email})`
            : failedSale?.bundle
            ? `${failedSale.bundle.name} (${failedSale.buyer_email})`
            : failedSale?.buyer_email ?? null,
          changes: { new: { payment_status: "failed", asaas_event: payload.event } },
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
};

serve(handler);
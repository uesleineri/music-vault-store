import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";

const handler = async (req: Request): Promise<Response> => {
  try {
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

      // Update sale status
      const { data: sale, error: updateError } = await supabase
        .from("sales")
        .update({ payment_status: "paid" })
        .eq("id", externalReference)
        .select(`
          *,
          multitrack:multitracks(*)
        `)
        .single();

      if (updateError) {
        console.error("Error updating sale:", updateError);
        throw updateError;
      }

      console.log("Sale updated to paid:", sale.id);

      // Grant the buyer access to the file on Drive; Google sends its own
      // "shared with you" notification email automatically.
      const driveFileId = sale.multitrack?.file_url;
      if (driveFileId) {
        try {
          const accessToken = await googleDrive.getAccessToken();
          await googleDrive.shareFileWithUser(
            driveFileId,
            sale.buyer_email,
            accessToken,
            sale.download_expires_at
          );
          console.log("Shared Drive file with buyer:", sale.buyer_email);
        } catch (shareError) {
          // Don't fail the webhook (Asaas would retry) if sharing hiccups -
          // get-download retries the share as a fallback when the buyer opens the link.
          console.error("Failed to share Drive file with buyer:", shareError);
        }
      }
    }

    if (payload.event === "PAYMENT_OVERDUE" || payload.event === "PAYMENT_DELETED") {
      const externalReference = payload.payment?.externalReference;
      
      if (externalReference) {
        await supabase
          .from("sales")
          .update({ payment_status: "failed" })
          .eq("id", externalReference);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
};

serve(handler);
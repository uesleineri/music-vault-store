import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { logAudit } from "../_shared/audit.ts";
import { getSaleItems } from "../_shared/sale-items.ts";
import { distributeFee, describeGroup } from "../_shared/checkout-group.ts";
import { ensureCustomerAccount } from "../_shared/customer-account.ts";
import { notifyAdmins } from "../_shared/admin-notifications.ts";

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

      // Update every sales row in this checkout group (one for a single-item
      // purchase, several for a cart) to paid.
      const { data: sales, error: updateError } = await supabase
        .from("sales")
        .update({ payment_status: "paid" })
        .eq("checkout_group_id", externalReference)
        .select(`
          *,
          multitrack:multitracks(*),
          bundle:bundles(*)
        `);

      if (updateError) {
        console.error("Error updating sales:", updateError);
        throw updateError;
      }
      if (!sales || sales.length === 0) {
        console.log("No sales found for checkout group, skipping:", externalReference);
        return new Response("OK", { status: 200 });
      }

      console.log(`${sales.length} sale(s) updated to paid for group:`, externalReference);

      // Asaas' PIX payment object includes value/netValue (netValue = value
      // minus the Asaas fee) for the whole payment - split it across the
      // group's rows proportionally so per-sale reporting still adds up.
      const grossValue = payload.payment?.value;
      const netValue = payload.payment?.netValue;
      if (typeof grossValue === "number" && typeof netValue === "number") {
        const feeUpdates = distributeFee(sales, grossValue, netValue);
        await Promise.all(
          feeUpdates.map((update) =>
            supabase.from("sales").update({ asaas_fee: update.asaas_fee, net_amount: update.net_amount }).eq("id", update.id)
          )
        );
      }

      const buyerEmail = sales[0].buyer_email;

      await supabase.from("funnel_events").insert({
        event_type: "payment_confirmed",
        checkout_group_id: externalReference,
      });

      await notifyAdmins(supabase, "payment_confirmed", sales, buyerEmail);

      await logAudit(supabase, req, {
        actorId: null,
        actorEmail: "webhook Asaas",
        action: "sale.payment_confirmed",
        targetType: "sale",
        targetId: sales[0].id,
        targetLabel: `${describeGroup(sales)} (${buyerEmail})`,
        changes: { old: { payment_status: "pending" }, new: { payment_status: "paid" } },
      });

      // Grant the buyer access to every file across every item in the group -
      // Google sends its own "shared with you" notification email automatically for each.
      try {
        const accessToken = await googleDrive.getAccessToken();
        const itemsBySale = await Promise.all(sales.map((sale: any) => getSaleItems(supabase, sale)));
        const shares = sales.flatMap((sale: any, index: number) =>
          itemsBySale[index].map((item) => ({ item, expiresAt: sale.download_expires_at }))
        );
        await Promise.all(
          shares.map(({ item, expiresAt }) => googleDrive.shareFileWithUser(item.file_url, buyerEmail, accessToken, expiresAt))
        );
        console.log(`Shared ${shares.length} Drive file(s) with buyer:`, buyerEmail);
      } catch (shareError) {
        // Don't fail the webhook (Asaas would retry) if sharing hiccups -
        // get-download retries the share as a fallback when the buyer opens the link.
        console.error("Failed to share Drive file(s) with buyer:", shareError);
      }

      try {
        await ensureCustomerAccount(supabase, buyerEmail);
      } catch (accountError) {
        console.error("Failed to create/invite customer account:", accountError);
      }
    }

    if (payload.event === "PAYMENT_OVERDUE" || payload.event === "PAYMENT_DELETED") {
      const externalReference = payload.payment?.externalReference;

      if (externalReference) {
        const { data: failedSales } = await supabase
          .from("sales")
          .update({ payment_status: "failed" })
          .eq("checkout_group_id", externalReference)
          .select(`*, multitrack:multitracks(*), bundle:bundles(*)`);

        if (failedSales && failedSales.length > 0) {
          await logAudit(supabase, req, {
            actorId: null,
            actorEmail: "webhook Asaas",
            action: "sale.payment_failed",
            targetType: "sale",
            targetId: failedSales[0].id,
            targetLabel: `${describeGroup(failedSales)} (${failedSales[0].buyer_email})`,
            changes: { new: { payment_status: "failed", asaas_event: payload.event } },
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
};

serve(handler);
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { logAudit } from "../_shared/audit.ts";
import { getSaleItems } from "../_shared/sale-items.ts";
import { distributeFee, describeGroup } from "../_shared/checkout-group.ts";
import { ensureCustomerAccount } from "../_shared/customer-account.ts";
import { notifyAdmins } from "../_shared/admin-notifications.ts";

// Mercado Pago signs every webhook call with an HMAC-SHA256 over a manifest
// built from the notified resource id + request id + timestamp (see
// x-signature header: "ts=...,v1=..."). Unlike Asaas' old static token
// comparison, this can't be replayed with a different payload, and it's
// bound to this specific request (x-request-id) and time window (ts).
async function isValidSignature(req: Request, secret: string): Promise<boolean> {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataId = new URL(req.url).searchParams.get("data.id");
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const pair of xSignature.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Mercado Pago's docs note data.id must be lowercased when comparing if
  // it's alphanumeric - harmless no-op for a purely numeric id.
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === v1;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("MERCADOPAGO_WEBHOOK_SECRET not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    const valid = await isValidSignature(req, webhookSecret);
    if (!valid) {
      console.error("Rejected webhook call: invalid or missing x-signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json().catch(() => ({}));
    console.log("Mercado Pago webhook received:", JSON.stringify(payload));

    const orderId = new URL(req.url).searchParams.get("data.id") ?? payload?.data?.id;
    if (!orderId) {
      console.log("No order id in webhook, skipping");
      return new Response("OK", { status: 200 });
    }

    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    // Never trust the webhook payload alone - always re-fetch the order's
    // real state directly from Mercado Pago before acting on it.
    const orderResponse = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${mercadoPagoAccessToken}` },
    });
    const order = await orderResponse.json();

    const externalReference = order?.external_reference;
    if (!externalReference) {
      console.log("No external reference on order, skipping:", orderId);
      return new Response("OK", { status: 200 });
    }

    const orderStatus = order?.status;
    const orderPayment = order?.transactions?.payments?.[0];

    if (orderStatus === "processed") {
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

      const buyerEmail = sales[0].buyer_email;

      // The Order response doesn't carry the fee breakdown, and its
      // transactions.payments[].id is an Orders-API-only id that the classic
      // GET /v1/payments/{id} doesn't recognize - the underlying payment is
      // only reachable by searching the classic Payments API by
      // external_reference (confirmed against the sandbox: this returns the
      // real numeric payment id, fee_details, and transaction_details.net_received_amount).
      // Column names (asaas_fee/net_amount) are kept as-is: they're generic
      // numeric fields, renaming them would need its own migration.
      try {
        const paymentSearchResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/search?external_reference=${externalReference}`,
          { headers: { Authorization: `Bearer ${mercadoPagoAccessToken}` } }
        );
        const paymentSearch = await paymentSearchResponse.json();
        const paymentDetail = paymentSearch?.results?.[0];
        const grossValue = paymentDetail?.transaction_amount;
        const netValue = paymentDetail?.transaction_details?.net_received_amount;
        if (typeof grossValue === "number" && typeof netValue === "number") {
          const feeUpdates = distributeFee(sales, grossValue, netValue);
          await Promise.all(
            feeUpdates.map((update) =>
              supabase.from("sales").update({ asaas_fee: update.asaas_fee, net_amount: update.net_amount }).eq("id", update.id)
            )
          );
        }
      } catch (feeError) {
        console.error("Failed to fetch/apply Mercado Pago fee breakdown:", feeError);
      }

      await supabase.from("funnel_events").insert({
        event_type: "payment_confirmed",
        checkout_group_id: externalReference,
      });

      await notifyAdmins(supabase, "payment_confirmed", sales, buyerEmail);

      await logAudit(supabase, req, {
        actorId: null,
        actorEmail: "webhook Mercado Pago",
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
        // Don't fail the webhook (Mercado Pago would retry) if sharing hiccups -
        // get-download retries the share as a fallback when the buyer opens the link.
        console.error("Failed to share Drive file(s) with buyer:", shareError);
      }

      try {
        await ensureCustomerAccount(supabase, buyerEmail);
      } catch (accountError) {
        console.error("Failed to create/invite customer account:", accountError);
      }
    } else if (orderStatus === "expired" || orderStatus === "cancelled" || orderPayment?.status === "rejected") {
      const { data: failedSales } = await supabase
        .from("sales")
        .update({ payment_status: "failed" })
        .eq("checkout_group_id", externalReference)
        .select(`*, multitrack:multitracks(*), bundle:bundles(*)`);

      if (failedSales && failedSales.length > 0) {
        await logAudit(supabase, req, {
          actorId: null,
          actorEmail: "webhook Mercado Pago",
          action: "sale.payment_failed",
          targetType: "sale",
          targetId: failedSales[0].id,
          targetLabel: `${describeGroup(failedSales)} (${failedSales[0].buyer_email})`,
          changes: {
            new: {
              payment_status: "failed",
              mercadopago_order_status: orderStatus,
              mercadopago_payment_status: orderPayment?.status ?? null,
            },
          },
        });
      }
    } else {
      console.log("Order status not actionable yet:", orderStatus);
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
};

serve(handler);

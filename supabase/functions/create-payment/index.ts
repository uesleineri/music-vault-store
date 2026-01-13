import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  multitrack_id: string;
  buyer_email: string;
  amount: number;
  multitrack_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { multitrack_id, buyer_email, amount, multitrack_name }: CreatePaymentRequest = await req.json();

    // Generate unique download token
    const downloadToken = crypto.randomUUID();
    const downloadExpiresAt = new Date();
    downloadExpiresAt.setHours(downloadExpiresAt.getHours() + 48); // 48 hours expiration

    // Create sale record first
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        multitrack_id,
        buyer_email,
        amount,
        payment_status: "pending",
        download_token: downloadToken,
        download_expires_at: downloadExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Create Asaas customer (or find existing)
    const customerResponse = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify({
        email: buyer_email,
        name: buyer_email.split("@")[0],
      }),
    });

    let customer;
    if (customerResponse.status === 409) {
      // Customer already exists, fetch by email
      const searchResponse = await fetch(
        `https://api.asaas.com/v3/customers?email=${encodeURIComponent(buyer_email)}`,
        {
          headers: { "access_token": asaasApiKey },
        }
      );
      const searchData = await searchResponse.json();
      customer = searchData.data[0];
    } else {
      customer = await customerResponse.json();
    }

    if (!customer?.id) {
      throw new Error("Failed to create/find customer");
    }

    // Create Asaas payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const paymentResponse = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify({
        customer: customer.id,
        billingType: "UNDEFINED", // Allows PIX, credit card, boleto
        value: amount,
        dueDate: dueDate.toISOString().split("T")[0],
        description: `Multitrack: ${multitrack_name}`,
        externalReference: sale.id,
      }),
    });

    const payment = await paymentResponse.json();

    if (!payment?.id) {
      throw new Error("Failed to create payment");
    }

    // Update sale with payment ID
    await supabase
      .from("sales")
      .update({ payment_id: payment.id })
      .eq("id", sale.id);

    // Get payment link
    const paymentLinkResponse = await fetch(
      `https://api.asaas.com/v3/payments/${payment.id}/identificationField`,
      {
        headers: { "access_token": asaasApiKey },
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: sale.id,
        payment_id: payment.id,
        payment_url: payment.invoiceUrl,
        pix_code: payment.pixQrCodeUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  multitrack_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_phone: string;
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

    const { multitrack_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, amount, multitrack_name }: CreatePaymentRequest = await req.json();

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
    const customerBody = {
      email: buyer_email,
      name: buyer_name,
      cpfCnpj: buyer_cpf,
      mobilePhone: buyer_phone,
    };
    
    console.log("Creating customer with body:", JSON.stringify(customerBody));
    
    const customerResponse = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify(customerBody),
    });

    let customer;
    const customerResponseData = await customerResponse.json();
    console.log("Customer response status:", customerResponse.status);
    console.log("Customer response data:", JSON.stringify(customerResponseData));

    if (customerResponse.status === 409 || customerResponseData.errors?.some((e: any) => e.code === "invalid_cpfCnpj_alreadyInUse")) {
      // Customer already exists, fetch by CPF
      console.log("Customer exists, searching by CPF...");
      const searchResponse = await fetch(
        `https://api.asaas.com/v3/customers?cpfCnpj=${buyer_cpf}`,
        {
          headers: { "access_token": asaasApiKey },
        }
      );
      const searchData = await searchResponse.json();
      console.log("Search response:", JSON.stringify(searchData));
      customer = searchData.data?.[0];
    } else if (customerResponseData.id) {
      customer = customerResponseData;
    } else {
      console.error("Customer creation failed:", customerResponseData);
      throw new Error(`Failed to create customer: ${JSON.stringify(customerResponseData)}`);
    }

    if (!customer?.id) {
      throw new Error("Failed to create/find customer");
    }

    // Create Asaas PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow

    const paymentBody = {
      customer: customer.id,
      billingType: "PIX", // PIX only
      value: amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Multitrack: ${multitrack_name}`,
      externalReference: sale.id,
    };

    console.log("Creating PIX payment with body:", JSON.stringify(paymentBody));

    const paymentResponse = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await paymentResponse.json();
    console.log("Asaas payment response:", JSON.stringify(payment));

    if (!payment?.id) {
      console.error("Payment creation failed:", payment);
      throw new Error(`Failed to create payment: ${JSON.stringify(payment)}`);
    }

    // Update sale with payment ID
    await supabase
      .from("sales")
      .update({ payment_id: payment.id })
      .eq("id", sale.id);

    // Get PIX QR Code
    const pixResponse = await fetch(
      `https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`,
      {
        headers: { "access_token": asaasApiKey },
      }
    );
    
    const pixData = await pixResponse.json();
    console.log("PIX QR Code response:", JSON.stringify(pixData));

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: sale.id,
        payment_id: payment.id,
        pix_qr_code_image: pixData.encodedImage, // Base64 image
        pix_copy_paste: pixData.payload, // Copy-paste code
        pix_expiration: pixData.expirationDate,
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
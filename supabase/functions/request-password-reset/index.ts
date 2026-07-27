import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// "Forgot password" / "still haven't set one" is inherently a public,
// unauthenticated action - anyone can type in any email. Without a limit,
// this becomes a way to spam a stranger's inbox with reset-link emails
// (or an invite/recovery link expiring by design, see SetPassword.tsx's
// resend form). Both entry points to this capability
// (MyAccount.tsx's "esqueci minha senha" and SetPassword.tsx's "link
// expirado" resend) now go through here instead of calling
// resetPasswordForEmail directly from the browser.
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 8;

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      supabase
        .from("password_reset_attempts")
        .select("id", { count: "exact", head: true })
        .ilike("email", email.trim())
        .gte("created_at", since),
      ip
        ? supabase
            .from("password_reset_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_HOUR || (ipCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await supabase.from("password_reset_attempts").insert({ email: email.trim(), ip_address: ip });

    // Same call the frontend used to make directly - Supabase itself never
    // reveals whether the account exists, so neither does this response.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:8080"}/minha-conta/definir-senha`,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in request-password-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

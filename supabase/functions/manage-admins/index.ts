import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerAdminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerAdminRow) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data: admins, error: adminsError } = await supabase
        .from("admin_users")
        .select("id, user_id, created_at")
        .order("created_at", { ascending: true });
      if (adminsError) throw adminsError;

      const { data: usersList, error: usersError } = await supabase.auth.admin.listUsers();
      if (usersError) throw usersError;

      const enriched = admins.map((admin: any) => {
        const authUser = usersList.users.find((u: any) => u.id === admin.user_id);
        return { ...admin, email: authUser?.email ?? "(usuário não encontrado)" };
      });

      return json({ admins: enriched });
    }

    if (action === "add") {
      const email: string | undefined = body.email?.trim().toLowerCase();
      if (!email) return json({ error: "E-mail é obrigatório" }, 400);

      // Find an existing auth user by email, or invite a brand-new one.
      const { data: usersList, error: usersError } = await supabase.auth.admin.listUsers();
      if (usersError) throw usersError;
      let targetUser = usersList.users.find((u: any) => u.email?.toLowerCase() === email);

      if (!targetUser) {
        const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
        if (inviteError) throw inviteError;
        targetUser = invited.user;
      }

      const { data: existingAdmin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", targetUser.id)
        .maybeSingle();
      if (existingAdmin) return json({ error: "Este usuário já é administrador" }, 400);

      const { data: newAdmin, error: insertError } = await supabase
        .from("admin_users")
        .insert({ user_id: targetUser.id })
        .select()
        .single();
      if (insertError) throw insertError;

      return json({ admin: { ...newAdmin, email: targetUser.email } });
    }

    if (action === "remove") {
      const adminUserId: string | undefined = body.admin_user_id;
      if (!adminUserId) return json({ error: "admin_user_id é obrigatório" }, 400);

      const { count } = await supabase
        .from("admin_users")
        .select("id", { count: "exact", head: true });
      if ((count ?? 0) <= 1) {
        return json({ error: "Não é possível remover o último administrador" }, 400);
      }

      const { data: targetRow } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("id", adminUserId)
        .maybeSingle();
      if (targetRow?.user_id === user.id) {
        return json({ error: "Você não pode remover a si mesmo" }, 400);
      }

      const { error: deleteError } = await supabase.from("admin_users").delete().eq("id", adminUserId);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    console.error("Error in manage-admins:", error);
    return json({ error: error.message }, 500);
  }
};

serve(handler);

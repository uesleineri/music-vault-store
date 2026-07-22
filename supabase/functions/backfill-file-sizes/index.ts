import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logAudit } from "../_shared/audit.ts";

// One-off maintenance action: multitracks catalogued before file_size_bytes
// existed (see 20260722030000) have it null - their real file is already in
// Drive, so there's no need to re-upload just to learn its size. Looks each
// one up directly by its existing file_url (the Drive file id) instead.
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
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
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: rows, error: fetchError } = await supabase
      .from("multitracks")
      .select("id, artist_name, song_name, file_url")
      .is("file_size_bytes", null);
    if (fetchError) throw fetchError;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ updated: 0, failed: 0, failedItems: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = await googleDrive.getAccessToken();
    let updated = 0;
    const failedItems: { id: string; label: string; reason: string }[] = [];

    for (const row of rows) {
      const label = `${row.artist_name} - ${row.song_name}`;
      try {
        const file = await googleDrive.getFile(row.file_url, accessToken);
        const sizeBytes = file.size ? parseInt(file.size, 10) : null;
        if (sizeBytes) {
          const { error: updateError } = await supabase
            .from("multitracks")
            .update({ file_size_bytes: sizeBytes })
            .eq("id", row.id);
          if (updateError) throw updateError;
          updated++;
        } else {
          failedItems.push({ id: row.id, label, reason: "Arquivo sem tamanho informado pelo Drive" });
        }
      } catch (rowError: any) {
        // Most likely cause: the Drive file this row points to (file_url) was
        // deleted or moved outside the app's folder structure - e.g. by hand,
        // while cleaning up a duplicate. This multitrack's real download is
        // broken, not just its ficha técnica - re-upload the audio file via
        // "Editar" to fix it for real.
        console.error(`Failed to backfill file size for multitrack ${row.id} (${label}):`, rowError);
        failedItems.push({ id: row.id, label, reason: "Arquivo não encontrado no Drive - o download dessa música pode estar quebrado" });
      }
    }

    if (failedItems.length > 0) {
      await logAudit(supabase, req, {
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: "multitrack.file_size_backfill_failed",
        targetType: "multitrack",
        targetLabel: failedItems.map((f) => f.label).join(", "),
        changes: { failedItems },
      });
    }

    return new Response(JSON.stringify({ updated, failed: failedItems.length, failedItems }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in backfill-file-sizes:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

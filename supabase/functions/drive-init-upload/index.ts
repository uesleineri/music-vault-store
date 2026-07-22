import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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

    // Verify the caller is a logged-in admin before handing out Drive access.
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminRow } = await adminClient
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

    const { file_name, mime_type, artist_name, song_name } = await req.json();
    if (!file_name || !artist_name || !song_name) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = await googleDrive.getAccessToken();
    const folderId = await googleDrive.ensureSongFolder(artist_name, song_name, accessToken);

    // A resumable session reserves a new Drive file the instant it starts -
    // if a file with this exact name is already sitting in the folder
    // (a stale duplicate from a previous attempt the admin retried, or the
    // old version being replaced), clear it out first so this upload never
    // ends up as a second copy alongside it.
    const existingFileIds = await googleDrive.findFilesByName(file_name, folderId, accessToken);
    await Promise.all(existingFileIds.map((id: string) => googleDrive.deleteFile(id, accessToken)));

    const resumableUrl = await googleDrive.createResumableUploadSession(
      file_name,
      mime_type || "application/octet-stream",
      folderId,
      accessToken
    );

    return new Response(
      JSON.stringify({ resumable_url: resumableUrl, access_token: accessToken, folder_id: folderId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in drive-init-upload:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

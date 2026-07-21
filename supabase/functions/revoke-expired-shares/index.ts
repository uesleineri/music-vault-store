import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDrive } from "../_shared/google-drive.ts";
import { getSaleItems } from "../_shared/sale-items.ts";

// Google Drive only honors a permission's `expirationTime` for Shared Drive
// items or Google Workspace accounts - on the personal Gmail account this
// store actually uses, Drive silently ignores it, so a buyer's Drive share
// never expires on its own even though the app's download token does (see
// get-download, which already refuses an expired token). This job closes
// that gap by explicitly revoking the Drive permission once
// download_expires_at has passed, so real access matches what the store
// promises. Scheduled hourly via pg_cron (see migration
// 20260721030000_add_drive_revocation.sql) - not a destructive action, so it
// doesn't need the admin-session auth the rest of the admin-only functions
// require, only the project's own anon/service key to reach it at all.
const handler = async (_req: Request): Promise<Response> => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sales, error } = await supabase
      .from("sales")
      .select("*, multitrack:multitracks(*), bundle:bundles(*)")
      .eq("payment_status", "paid")
      .is("drive_access_revoked_at", null)
      .lt("download_expires_at", new Date().toISOString());
    if (error) throw error;

    if (!sales || sales.length === 0) {
      return new Response(JSON.stringify({ checked: 0, revoked: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const accessToken = await googleDrive.getAccessToken();
    let revokedCount = 0;

    // Sequential, not Promise.all - keeps Drive API call volume predictable
    // for what's expected to be a small batch each run (48h expiry window).
    for (const sale of sales) {
      try {
        const items = await getSaleItems(supabase, sale);
        await Promise.all(
          items.map((item) => googleDrive.revokeAccessForUser(item.file_url, sale.buyer_email, accessToken))
        );
        await supabase.from("sales").update({ drive_access_revoked_at: new Date().toISOString() }).eq("id", sale.id);
        revokedCount++;
      } catch (revokeError) {
        console.error(`Failed to revoke Drive access for sale ${sale.id}:`, revokeError);
      }
    }

    return new Response(JSON.stringify({ checked: sales.length, revoked: revokedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in revoke-expired-shares:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface GeneratePreviewRequest {
  multitrack_id: string;
  file_path: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { multitrack_id, file_path }: GeneratePreviewRequest = await req.json();

    console.log("Generating preview for:", multitrack_id, file_path);

    // Download the original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("multitracks")
      .download(file_path);

    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      throw new Error("Could not download original file");
    }

    // For audio files, we'll extract a portion of the file
    // Since we can't use ffmpeg in edge functions, we'll create a simple preview
    // by taking the first portion of the audio file
    
    const arrayBuffer = await fileData.arrayBuffer();
    const fullSize = arrayBuffer.byteLength;
    
    // Take first 30 seconds worth (approximately - this is a rough estimate)
    // For a typical MP3 at 128kbps, 30 seconds ≈ 480KB
    // For WAV files, this will be larger
    const previewSize = Math.min(fullSize, 500 * 1024); // Max 500KB for preview
    
    const previewBuffer = arrayBuffer.slice(0, previewSize);
    const previewBlob = new Blob([previewBuffer], { type: fileData.type });

    // Upload preview
    const previewFileName = `preview-${multitrack_id}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("previews")
      .upload(previewFileName, previewBlob, {
        contentType: fileData.type || "audio/mpeg",
      });

    if (uploadError) {
      console.error("Error uploading preview:", uploadError);
      throw new Error("Could not upload preview");
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("previews")
      .getPublicUrl(previewFileName);

    // Update multitrack with preview URL
    const { error: updateError } = await supabase
      .from("multitracks")
      .update({ preview_url: publicUrl })
      .eq("id", multitrack_id);

    if (updateError) {
      console.error("Error updating multitrack:", updateError);
      throw new Error("Could not update multitrack with preview URL");
    }

    console.log("Preview generated successfully:", publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        preview_url: publicUrl 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-preview:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
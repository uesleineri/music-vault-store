import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, song } = await req.json();
    
    if (!artist || !song) {
      throw new Error("Artist and song are required");
    }

    const query = `${artist} ${song}`;
    console.log("Searching cover for:", query);

    // Try Deezer API first
    const deezerResponse = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`
    );
    
    const deezerData = await deezerResponse.json();
    console.log("Deezer response:", JSON.stringify(deezerData));

    if (deezerData.data && deezerData.data.length > 0) {
      // Find the best match
      const track = deezerData.data[0];
      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium;
      
      if (coverUrl) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            cover_url: coverUrl,
            source: "deezer",
            artist: track.artist?.name,
            title: track.title,
            album: track.album?.title
          }),
          { 
            status: 200, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
          }
        );
      }
    }

    // If Deezer fails, try iTunes API
    const itunesResponse = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=5`
    );
    
    const itunesData = await itunesResponse.json();
    console.log("iTunes response:", JSON.stringify(itunesData));

    if (itunesData.results && itunesData.results.length > 0) {
      const track = itunesData.results[0];
      // Get high-res artwork (replace 100x100 with 600x600)
      const coverUrl = track.artworkUrl100?.replace('100x100', '600x600');
      
      if (coverUrl) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            cover_url: coverUrl,
            source: "itunes",
            artist: track.artistName,
            title: track.trackName,
            album: track.collectionName
          }),
          { 
            status: 200, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Cover not found" 
      }),
      { 
        status: 404, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error in search-cover:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);

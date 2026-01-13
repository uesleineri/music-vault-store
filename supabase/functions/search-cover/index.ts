import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize string for comparison
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim();
}

// Calculate similarity score between two strings
function similarity(str1: string, str2: string): number {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matches = 0;
  for (const word of words1) {
    if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Find best matching track from results
function findBestMatch(tracks: any[], songName: string, artistName: string): any | null {
  if (!tracks || tracks.length === 0) return null;
  
  const normalizedSong = normalize(songName);
  const normalizedArtist = normalize(artistName);
  
  // Check for special keywords like "Ao Vivo", "Live", etc.
  const liveKeywords = ['ao vivo', 'live', 'acustico', 'acoustic', 'unplugged'];
  const hasLiveKeyword = liveKeywords.some(kw => normalizedSong.includes(normalize(kw)));
  
  let bestTrack = null;
  let bestScore = -1;
  
  for (const track of tracks) {
    const trackTitle = track.title || track.trackName || '';
    const trackArtist = track.artist?.name || track.artistName || '';
    const albumTitle = track.album?.title || track.collectionName || '';
    
    // Calculate song title similarity
    const titleScore = similarity(trackTitle, songName);
    
    // Calculate artist similarity
    const artistScore = similarity(trackArtist, artistName);
    
    // Check if album/track matches live keyword preference
    let liveBonus = 0;
    if (hasLiveKeyword) {
      const normalizedAlbum = normalize(albumTitle);
      const normalizedTitle = normalize(trackTitle);
      if (liveKeywords.some(kw => normalizedAlbum.includes(normalize(kw)) || normalizedTitle.includes(normalize(kw)))) {
        liveBonus = 0.3;
      }
    }
    
    // Combined score with weights
    const totalScore = (titleScore * 0.5) + (artistScore * 0.3) + liveBonus + (track.rank ? track.rank / 1000000 : 0);
    
    console.log(`Track: "${trackTitle}" by "${trackArtist}" (Album: "${albumTitle}") - Score: ${totalScore.toFixed(3)}`);
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestTrack = track;
    }
  }
  
  console.log(`Best match: "${bestTrack?.title || bestTrack?.trackName}" with score ${bestScore.toFixed(3)}`);
  return bestTrack;
}

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

    // Try Deezer API first with more results for better matching
    const deezerResponse = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=15`
    );
    
    const deezerData = await deezerResponse.json();
    console.log(`Deezer returned ${deezerData.data?.length || 0} results`);

    if (deezerData.data && deezerData.data.length > 0) {
      const bestTrack = findBestMatch(deezerData.data, song, artist);
      
      if (bestTrack) {
        const coverUrl = bestTrack.album?.cover_xl || bestTrack.album?.cover_big || bestTrack.album?.cover_medium;
        
        if (coverUrl) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              cover_url: coverUrl,
              source: "deezer",
              artist: bestTrack.artist?.name,
              title: bestTrack.title,
              album: bestTrack.album?.title
            }),
            { 
              status: 200, 
              headers: { "Content-Type": "application/json", ...corsHeaders } 
            }
          );
        }
      }
    }

    // If Deezer fails, try iTunes API
    const itunesResponse = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`
    );
    
    const itunesData = await itunesResponse.json();
    console.log(`iTunes returned ${itunesData.results?.length || 0} results`);

    if (itunesData.results && itunesData.results.length > 0) {
      const bestTrack = findBestMatch(itunesData.results, song, artist);
      
      if (bestTrack) {
        // Get high-res artwork (replace 100x100 with 600x600)
        const coverUrl = bestTrack.artworkUrl100?.replace('100x100', '600x600');
        
        if (coverUrl) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              cover_url: coverUrl,
              source: "itunes",
              artist: bestTrack.artistName,
              title: bestTrack.trackName,
              album: bestTrack.collectionName
            }),
            { 
              status: 200, 
              headers: { "Content-Type": "application/json", ...corsHeaders } 
            }
          );
        }
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

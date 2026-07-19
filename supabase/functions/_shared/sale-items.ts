export interface SaleItem {
  artist_name: string;
  song_name: string;
  cover_url: string | null;
  file_url: string;
}

// A sale is for one multitrack (one file) or one bundle (many files) - this
// resolves either shape into a flat list of {name, file} pairs so every
// caller can loop the same way instead of special-casing bundles.
export async function getSaleItems(supabase: any, sale: any): Promise<SaleItem[]> {
  if (sale.multitrack) {
    return [
      {
        artist_name: sale.multitrack.artist_name,
        song_name: sale.multitrack.song_name,
        cover_url: sale.multitrack.cover_url,
        file_url: sale.multitrack.file_url,
      },
    ];
  }

  if (sale.bundle_id) {
    const { data: items, error } = await supabase
      .from("bundle_items")
      .select("multitrack:multitracks(artist_name, song_name, cover_url, file_url)")
      .eq("bundle_id", sale.bundle_id);
    if (error) throw error;
    return (items ?? []).map((item: any) => item.multitrack).filter(Boolean);
  }

  return [];
}

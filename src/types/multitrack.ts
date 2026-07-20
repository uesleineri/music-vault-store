export interface Multitrack {
  id: string;
  artist_name: string;
  song_name: string;
  price: number;
  cover_url: string | null;
  file_url: string;
  preview_url: string | null;
  is_active: boolean;
  // Advanced-search metadata - all optional, may be null on older/unfilled rows.
  genre: string | null;
  key_signature: string | null;
  bpm: number | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bundle {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cover_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BundleItem {
  id: string;
  bundle_id: string;
  multitrack_id: string;
  created_at: string;
  multitrack?: Multitrack;
}

export interface Sale {
  id: string;
  // Exactly one of these two is set - a sale is either for one multitrack or one bundle.
  multitrack_id: string | null;
  bundle_id: string | null;
  // Sales rows created in the same checkout (a cart with several items, one
  // PIX payment) share this id - a single-item purchase is a group of one.
  checkout_group_id: string;
  buyer_email: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_id: string | null;
  download_token: string | null;
  download_expires_at: string | null;
  coupon_id: string | null;
  discount_amount: number;
  asaas_fee: number | null;
  net_amount: number | null;
  created_at: string;
  multitrack?: Multitrack;
  bundle?: Bundle;
}

export interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
}

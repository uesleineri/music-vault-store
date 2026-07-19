export interface Multitrack {
  id: string;
  artist_name: string;
  song_name: string;
  price: number;
  cover_url: string | null;
  file_url: string;
  preview_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  multitrack_id: string;
  buyer_email: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_id: string | null;
  download_token: string | null;
  download_expires_at: string | null;
  created_at: string;
  multitrack?: Multitrack;
}

export interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
}

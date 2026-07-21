export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          checkout_group_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
        }
        Insert: {
          checkout_group_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type: string
        }
        Update: {
          checkout_group_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          checkout_group_id: string | null
          created_at: string
          event_type: string
          id: string
          product_ref: string | null
          session_id: string | null
        }
        Insert: {
          checkout_group_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          product_ref?: string | null
          session_id?: string | null
        }
        Update: {
          checkout_group_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          product_ref?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      bundles: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          multitrack_id: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          multitrack_id: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          multitrack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_multitrack_id_fkey"
            columns: ["multitrack_id"]
            isOneToOne: false
            referencedRelation: "multitracks"
            referencedColumns: ["id"]
          },
        ]
      }
      multitracks: {
        Row: {
          artist_name: string
          bpm: number | null
          cover_url: string | null
          created_at: string
          file_url: string
          genre: string | null
          id: string
          key_signature: string | null
          language: string | null
          preview_url: string | null
          price: number
          song_name: string
          updated_at: string
        }
        Insert: {
          artist_name: string
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          file_url: string
          genre?: string | null
          id?: string
          key_signature?: string | null
          language?: string | null
          preview_url?: string | null
          price: number
          song_name: string
          updated_at?: string
        }
        Update: {
          artist_name?: string
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          file_url?: string
          genre?: string | null
          id?: string
          key_signature?: string | null
          language?: string | null
          preview_url?: string | null
          price?: number
          song_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          asaas_fee: number | null
          bundle_id: string | null
          buyer_email: string
          checkout_group_id: string
          coupon_id: string | null
          created_at: string
          discount_amount: number
          download_expires_at: string | null
          download_token: string | null
          id: string
          multitrack_id: string | null
          net_amount: number | null
          payment_id: string | null
          payment_status: string
        }
        Insert: {
          amount: number
          asaas_fee?: number | null
          bundle_id?: string | null
          buyer_email: string
          checkout_group_id?: string
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          download_expires_at?: string | null
          download_token?: string | null
          id?: string
          multitrack_id?: string | null
          net_amount?: number | null
          payment_id?: string | null
          payment_status?: string
        }
        Update: {
          amount?: number
          asaas_fee?: number | null
          bundle_id?: string | null
          buyer_email?: string
          checkout_group_id?: string
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          download_expires_at?: string | null
          download_token?: string | null
          id?: string
          multitrack_id?: string | null
          net_amount?: number | null
          payment_id?: string | null
          payment_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_multitrack_id_fkey"
            columns: ["multitrack_id"]
            isOneToOne: false
            referencedRelation: "multitracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          bundle_id: string | null
          buyer_email: string
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          multitrack_id: string | null
          rating: number
          reviewer_name: string
        }
        Insert: {
          bundle_id?: string | null
          buyer_email: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          multitrack_id?: string | null
          rating: number
          reviewer_name: string
        }
        Update: {
          bundle_id?: string | null
          buyer_email?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          multitrack_id?: string | null
          rating?: number
          reviewer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_multitrack_id_fkey"
            columns: ["multitrack_id"]
            isOneToOne: false
            referencedRelation: "multitracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      review_summaries: {
        Row: {
          average_rating: number | null
          bundle_id: string | null
          multitrack_id: string | null
          review_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_frequently_bought_with: {
        Args: { p_multitrack_id: string; p_limit?: number }
        Returns: { multitrack_id: string; purchase_count: number }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

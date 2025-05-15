export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bot_logs: {
        Row: {
          bot_type: string | null
          category: string
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string | null
          timestamp: string
          tx_hash: string | null
        }
        Insert: {
          bot_type?: string | null
          category: string
          created_at?: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
          source?: string | null
          timestamp?: string
          tx_hash?: string | null
        }
        Update: {
          bot_type?: string | null
          category?: string
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string | null
          timestamp?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      bot_statistics: {
        Row: {
          average_profit: number
          bot_type: string
          gas_spent: number
          id: string
          success_rate: number
          total_profit: number
          transactions_count: number
          updated_at: string | null
        }
        Insert: {
          average_profit?: number
          bot_type: string
          gas_spent?: number
          id?: string
          success_rate?: number
          total_profit?: number
          transactions_count?: number
          updated_at?: string | null
        }
        Update: {
          average_profit?: number
          bot_type?: string
          gas_spent?: number
          id?: string
          success_rate?: number
          total_profit?: number
          transactions_count?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      bot_transactions: {
        Row: {
          action: string
          bot_type: string
          collateral_amount: string | null
          created_at: string | null
          gas: number | null
          health_factor: number | null
          id: string
          profit: number | null
          protocol: string | null
          status: string
          timestamp: string | null
          tx_hash: string
          user_address: string | null
        }
        Insert: {
          action: string
          bot_type: string
          collateral_amount?: string | null
          created_at?: string | null
          gas?: number | null
          health_factor?: number | null
          id: string
          profit?: number | null
          protocol?: string | null
          status: string
          timestamp?: string | null
          tx_hash: string
          user_address?: string | null
        }
        Update: {
          action?: string
          bot_type?: string
          collateral_amount?: string | null
          created_at?: string | null
          gas?: number | null
          health_factor?: number | null
          id?: string
          profit?: number | null
          protocol?: string | null
          status?: string
          timestamp?: string | null
          tx_hash?: string
          user_address?: string | null
        }
        Relationships: []
      }
      monitored_users: {
        Row: {
          collateral_amount: string | null
          collateral_asset: string | null
          debt_amount: string | null
          debt_asset: string | null
          first_detected_at: string | null
          health_factor: number | null
          id: string
          is_active: boolean | null
          last_checked_at: string | null
          liquidation_threshold: number | null
          metadata: Json | null
          protocol: string
          user_address: string
        }
        Insert: {
          collateral_amount?: string | null
          collateral_asset?: string | null
          debt_amount?: string | null
          debt_asset?: string | null
          first_detected_at?: string | null
          health_factor?: number | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          liquidation_threshold?: number | null
          metadata?: Json | null
          protocol: string
          user_address: string
        }
        Update: {
          collateral_amount?: string | null
          collateral_asset?: string | null
          debt_amount?: string | null
          debt_asset?: string | null
          first_detected_at?: string | null
          health_factor?: number | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          liquidation_threshold?: number | null
          metadata?: Json | null
          protocol?: string
          user_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_bot_logs_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_bot_statistics_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_bot_transactions_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      request_database_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

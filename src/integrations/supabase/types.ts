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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          admin_pin: string
          almox_pin: string
          id: number
          oficina_pin: string
        }
        Insert: {
          admin_pin?: string
          almox_pin?: string
          id?: number
          oficina_pin?: string
        }
        Update: {
          admin_pin?: string
          almox_pin?: string
          id?: number
          oficina_pin?: string
        }
        Relationships: []
      }
      attended_calls: {
        Row: {
          call_date: string
          call_time: string | null
          company: string
          created_at: string
          description: string
          id: string
          technician: string
          updated_at: string
        }
        Insert: {
          call_date: string
          call_time?: string | null
          company?: string
          created_at?: string
          description?: string
          id?: string
          technician?: string
          updated_at?: string
        }
        Update: {
          call_date?: string
          call_time?: string | null
          company?: string
          created_at?: string
          description?: string
          id?: string
          technician?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contractor_name: string
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          contractor_name: string
          created_at?: string
          data: Json
          id?: string
          updated_at?: string
        }
        Update: {
          contractor_name?: string
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_returns: {
        Row: {
          client_name: string
          created_at: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      maquinas_paradas: {
        Row: {
          alerta_enviado: boolean
          cliente: string | null
          codigo_frota: string
          created_at: string
          data_conclusao: string | null
          data_inicio_parada: string
          id: string
          local: string | null
          motivo: string
          responsavel: string | null
          status: string
        }
        Insert: {
          alerta_enviado?: boolean
          cliente?: string | null
          codigo_frota: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio_parada?: string
          id?: string
          local?: string | null
          motivo: string
          responsavel?: string | null
          status?: string
        }
        Update: {
          alerta_enviado?: boolean
          cliente?: string | null
          codigo_frota?: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio_parada?: string
          id?: string
          local?: string | null
          motivo?: string
          responsavel?: string | null
          status?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          critical_points: Json
          decisions: Json
          id: string
          summary: string | null
          title: string
          todos: Json
          transcript: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          critical_points?: Json
          decisions?: Json
          id?: string
          summary?: string | null
          title?: string
          todos?: Json
          transcript?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          critical_points?: Json
          decisions?: Json
          id?: string
          summary?: string | null
          title?: string
          todos?: Json
          transcript?: string
          updated_at?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          created_at: string
          id: string
          name: string
          pin: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pin?: string
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pin?: string
          position?: number
        }
        Relationships: []
      }
      part_requests: {
        Row: {
          code: string
          created_at: string
          edited_at: string | null
          group_id: string
          id: string
          is_extra: boolean
          note: string | null
          original_group_id: string | null
          part_name: string
          quantity: number
          requester_name: string
          status: string
          superseded: boolean
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          edited_at?: string | null
          group_id?: string
          id?: string
          is_extra?: boolean
          note?: string | null
          original_group_id?: string | null
          part_name: string
          quantity?: number
          requester_name: string
          status?: string
          superseded?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          edited_at?: string | null
          group_id?: string
          id?: string
          is_extra?: boolean
          note?: string | null
          original_group_id?: string | null
          part_name?: string
          quantity?: number
          requester_name?: string
          status?: string
          superseded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          checked: boolean
          created_at: string
          edited_at: string | null
          id: string
          name: string
          original_name: string | null
          original_quantity: number | null
          position: number
          quantity: number
          schedule_id: string
          source: string
          status: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          edited_at?: string | null
          id?: string
          name: string
          original_name?: string | null
          original_quantity?: number | null
          position?: number
          quantity?: number
          schedule_id: string
          source?: string
          status?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          edited_at?: string | null
          id?: string
          name?: string
          original_name?: string | null
          original_quantity?: number | null
          position?: number
          quantity?: number
          schedule_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_calls: {
        Row: {
          call_date: string
          company: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          call_date: string
          company?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_date?: string
          company?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          id: string
          operator_id: string
          task: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          operator_id: string
          task?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          id?: string
          operator_id?: string
          task?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          schedule_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          schedule_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          schedule_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_loans: {
        Row: {
          checkout_date: string
          created_at: string
          id: string
          returned_at: string | null
          technician_name: string
          tool_name: string
          updated_at: string
        }
        Insert: {
          checkout_date?: string
          created_at?: string
          id?: string
          returned_at?: string | null
          technician_name?: string
          tool_name?: string
          updated_at?: string
        }
        Update: {
          checkout_date?: string
          created_at?: string
          id?: string
          returned_at?: string | null
          technician_name?: string
          tool_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      workshop_items: {
        Row: {
          approved_at: string | null
          created_at: string
          deadline_days: number
          id: string
          name: string
          status: string
          supplier: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          deadline_days?: number
          id?: string
          name?: string
          status?: string
          supplier?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          deadline_days?: number
          id?: string
          name?: string
          status?: string
          supplier?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

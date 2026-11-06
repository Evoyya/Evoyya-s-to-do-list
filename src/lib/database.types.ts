// Сгенерировано из схемы Supabase. Не править вручную.
// Обновить: npx supabase gen types typescript --project-id zxkdvwwxxbdvdikdrojh > src/lib/database.types.ts

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      checklist_items: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          note_id: string
          position: number
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          note_id: string
          position?: number
          text?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          note_id?: string
          position?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_items: {
        Row: {
          completed_at: string
          completed_by: string | null
          id: string
          item_id: string | null
          note_id: string
          text: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_id?: string | null
          note_id: string
          text: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_id?: string | null
          note_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          jar_id: string
          memory_date: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          jar_id: string
          memory_date?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          jar_id?: string
          memory_date?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_jar_id_fkey"
            columns: ["jar_id"]
            isOneToOne: false
            referencedRelation: "memory_jars"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_jar_members: {
        Row: {
          created_at: string
          jar_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          jar_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          jar_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_jar_members_jar_id_fkey"
            columns: ["jar_id"]
            isOneToOne: false
            referencedRelation: "memory_jars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_jar_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_jars: {
        Row: {
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_jars_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_labels: {
        Row: {
          label_id: string
          note_id: string
        }
        Insert: {
          label_id: string
          note_id: string
        }
        Update: {
          label_id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_labels_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_members: {
        Row: {
          archived_at: string | null
          created_at: string
          link_group: string | null
          note_id: string
          position: number
          role: Database["public"]["Enums"]["member_role"]
          sprint_id: string | null
          sprint_position: number | null
          urgency: Database["public"]["Enums"]["urgency"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          link_group?: string | null
          note_id: string
          position?: number
          role?: Database["public"]["Enums"]["member_role"]
          sprint_id?: string | null
          sprint_position?: number | null
          urgency?: Database["public"]["Enums"]["urgency"]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          link_group?: string | null
          note_id?: string
          position?: number
          role?: Database["public"]["Enums"]["member_role"]
          sprint_id?: string | null
          sprint_position?: number | null
          urgency?: Database["public"]["Enums"]["urgency"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_members_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_members_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
          owner_id: string
          position: number
          primary_label_id: string | null
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency"]
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          owner_id?: string
          position?: number
          primary_label_id?: string | null
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency"]
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          owner_id?: string
          position?: number
          primary_label_id?: string | null
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_primary_label_fkey"
            columns: ["id", "primary_label_id"]
            isOneToOne: false
            referencedRelation: "note_labels"
            referencedColumns: ["note_id", "label_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      sprints: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          shape: Database["public"]["Enums"]["sprint_shape"]
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          shape: Database["public"]["Enums"]["sprint_shape"]
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          shape?: Database["public"]["Enums"]["sprint_shape"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_my_jar: { Args: never; Returns: string }
      share_jar: { Args: { p_email: string }; Returns: string }
      share_note: {
        Args: { p_email: string; p_note_id: string }
        Returns: string
      }
      update_my_places: {
        Args: { p_places: Json }
        Returns: undefined
      }
    }
    Enums: {
      member_role: "owner" | "editor"
      note_kind: "permanent" | "temporary"
      sprint_shape:
        | "circle"
        | "square"
        | "triangle"
        | "diamond"
        | "hexagon"
        | "star"
        | "heart"
        | "shield"
      urgency: "critical" | "urgent" | "not_urgent" | "no_deadline"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      member_role: ["owner", "editor"],
      note_kind: ["permanent", "temporary"],
      sprint_shape: ["circle", "square", "triangle", "diamond", "hexagon", "star", "heart", "shield"],
      urgency: ["critical", "urgent", "not_urgent", "no_deadline"],
    },
  },
} as const

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Placeholder matching the shape emitted by `supabase gen types typescript`.
 * Replace this after the first database migration introduces schema objects.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; display_name: string; avatar_path: string | null; created_at: string; updated_at: string };
        Insert: { id: string; username: string; display_name: string; avatar_path?: string | null };
        Update: { username?: string; display_name?: string; avatar_path?: string | null };
        Relationships: [];
      };
      profile_settings: {
        Row: { user_id: string; height_cm: number | null; timezone: string; public_weight_trend: boolean; public_workout_details: boolean; photo_default_visibility: string; push_enabled: boolean; created_at: string; updated_at: string };
        Insert: { user_id: string; height_cm?: number | null; timezone: string };
        Update: { height_cm?: number | null; timezone?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      complete_onboarding: {
        Args: { p_username: string; p_display_name: string; p_height_cm: number | null; p_timezone: string; p_avatar_path?: string | null };
        Returns: string;
      };
    };
    Enums: { recurrence_type: "one_time" | "weekly" | "monthly" | "custom_dates"; occurrence_status: "pending" | "completed" | "skipped" | "cancelled" };
    CompositeTypes: Record<never, never>;
  };
};

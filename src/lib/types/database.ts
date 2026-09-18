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
      workout_plans: {
        Row: { id: string; user_id: string; title: string; description: string | null; duration_minutes: number | null; recurrence_type: Database["public"]["Enums"]["recurrence_type"]; start_date: string; end_date: string | null; days_of_week: number[] | null; days_of_month: number[] | null; start_time: string | null; reminder_enabled: boolean; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_custom_dates: {
        Row: { id: string; plan_id: string; scheduled_date: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_occurrences: {
        Row: { id: string; plan_id: string; user_id: string; scheduled_date: string; scheduled_time: string | null; notification_at: string | null; reminder_sent_at: string | null; status: Database["public"]["Enums"]["occurrence_status"]; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      complete_onboarding: {
        Args: { p_username: string; p_display_name: string; p_height_cm: number | null; p_timezone: string; p_avatar_path?: string | null };
        Returns: string;
      };
      create_workout_plan: { Args: { p_payload: Json }; Returns: string };
      update_workout_plan: { Args: { p_plan_id: string; p_payload: Json }; Returns: string };
      delete_workout_plan: { Args: { p_plan_id: string }; Returns: undefined };
      reschedule_future_notifications: { Args: { p_user_id: string }; Returns: undefined };
    };
    Enums: { recurrence_type: "one_time" | "weekly" | "monthly" | "custom_dates"; occurrence_status: "pending" | "completed" | "skipped" | "cancelled" };
    CompositeTypes: Record<never, never>;
  };
};

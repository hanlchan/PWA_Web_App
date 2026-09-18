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
      checkins: {
        Row: { id: string; user_id: string; occurrence_id: string | null; checkin_date: string; completed_at: string; duration_minutes: number | null; activity_text: string | null; notes: string | null; is_backfilled: boolean; created_at: string; updated_at: string };
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
      complete_occurrence: { Args: { p_occurrence_id: string }; Returns: string };
      create_manual_checkin: { Args: { p_checkin_date: string; p_is_backfilled: boolean }; Returns: string };
      update_checkin_details: { Args: { p_checkin_id: string; p_duration_minutes: number | null; p_activity_text: string; p_notes: string }; Returns: undefined };
      undo_checkin: { Args: { p_checkin_id: string }; Returns: undefined };
      get_today_dashboard: { Args: Record<never,never>; Returns: Json };
    };
    Enums: { recurrence_type: "one_time" | "weekly" | "monthly" | "custom_dates"; occurrence_status: "pending" | "completed" | "skipped" | "cancelled" };
    CompositeTypes: Record<never, never>;
  };
};

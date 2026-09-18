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
        Update: { height_cm?: number | null; timezone?: string; public_weight_trend?: boolean; public_workout_details?: boolean; photo_default_visibility?: string; push_enabled?: boolean };
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
      weight_entries: {
        Row: { id: string; user_id: string; weight_kg: number; measured_at: string; measurement_type: Database["public"]["Enums"]["weight_measurement_type"]; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      follows: { Row: { follower_id: string; following_id: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
      checkin_likes: { Row: { user_id: string; checkin_id: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
      notifications: { Row: { id: string; user_id: string; type: Database["public"]["Enums"]["notification_type"]; actor_id: string | null; data: Json; read_at: string | null; created_at: string }; Insert: never; Update: { read_at?: string | null }; Relationships: [] };
      nudges: { Row: { id: string; actor_id: string; target_id: string; nudge_date: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
      push_subscriptions: { Row: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; created_at: string; updated_at: string }; Insert: never; Update: never; Relationships: [] };
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
      get_user_stats: { Args: { p_month: string }; Returns: Json };
      get_calendar_month: { Args: { p_month: string }; Returns: { scheduled_date: string; state: string }[] };
      get_public_user_profile: { Args: { p_username: string; p_month: string }; Returns: Json };
      create_weight_entry: { Args: { p_weight_kg: number; p_measured_at: string; p_measurement_type: Database["public"]["Enums"]["weight_measurement_type"] }; Returns: string };
      delete_weight_entry: { Args: { p_entry_id: string }; Returns: undefined };
      get_private_weight_dashboard: { Args: Record<never, never>; Returns: Json };
      get_public_weight_trend: { Args: { p_username: string }; Returns: { measured_date: string; normalized_index: number }[] };
      search_public_users: { Args: { p_query: string }; Returns: { id: string; username: string; display_name: string; avatar_path: string | null; is_following: boolean }[] };
      toggle_follow: { Args: { p_target_id: string }; Returns: boolean };
      get_following_feed: { Args: { p_limit?: number }; Returns: Json };
      toggle_checkin_like: { Args: { p_checkin_id: string }; Returns: boolean };
      send_nudge: { Args: { p_target_id: string }; Returns: string };
      get_my_notifications: { Args: { p_limit?: number }; Returns: Json };
      mark_notifications_read: { Args: Record<never, never>; Returns: undefined };
      save_push_subscription: { Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent: string }; Returns: string };
      remove_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
      generate_all_occurrences: { Args: Record<never, never>; Returns: number };
      claim_due_reminders: { Args: { p_limit?: number }; Returns: { occurrence_id: string; user_id: string; title: string; scheduled_time: string | null }[] };
    };
    Enums: { recurrence_type: "one_time" | "weekly" | "monthly" | "custom_dates"; occurrence_status: "pending" | "completed" | "skipped" | "cancelled"; weight_measurement_type: "morning" | "evening" | "custom"; notification_type: "workout_reminder" | "nudge" | "like" };
    CompositeTypes: Record<never, never>;
  };
};

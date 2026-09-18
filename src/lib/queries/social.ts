import "server-only";
import { createClient } from "@/lib/supabase/server";
import { userSearchSchema } from "@/lib/validation/social";

export type SearchUser = { id: string; username: string; display_name: string; avatar_path: string | null; is_following: boolean };
export type FeedItem = { checkin_id: string; checkin_date: string; completed_at: string; user_id: string; username: string; display_name: string; avatar_path: string | null; total_checkin_days: number; like_count: number; liked_by_me: boolean; can_nudge: boolean };
export type NotificationItem = { id: string; type: "nudge" | "like" | "workout_reminder"; data: Record<string, unknown>; read_at: string | null; created_at: string; actor_username: string | null; actor_display_name: string | null };

export async function getSocialPage(query?: string) {
  const supabase = await createClient();
  const search = userSearchSchema.safeParse(query ?? "");
  const [feedResult, searchResult] = await Promise.all([
    supabase.rpc("get_following_feed", { p_limit: 30 }),
    search.success ? supabase.rpc("search_public_users", { p_query: search.data }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (feedResult.error || searchResult.error) throw new Error("无法读取好友动态");
  return { feed: (feedResult.data ?? []) as unknown as FeedItem[], users: (searchResult.data ?? []) as unknown as SearchUser[], searchError: query && !search.success ? search.error.issues[0]?.message : null };
}

export async function getNotifications() {
  const { data, error } = await (await createClient()).rpc("get_my_notifications", { p_limit: 30 });
  if (error) throw new Error("无法读取通知");
  return (data ?? []) as unknown as NotificationItem[];
}

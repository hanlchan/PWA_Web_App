import { createClient } from "@/lib/supabase/server";

export type PublicProfile = {
  username: string;
  display_name: string;
  avatar_path: string | null;
  total_checkin_days: number;
  month_checkin_days: number;
  current_streak: number;
  checkin_dates: string[];
};

export async function getPublicProfile(username: string, month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_user_profile", {
    p_username: username,
    p_month: month,
  });
  if (error) throw new Error("无法读取公开主页");
  return data as unknown as PublicProfile | null;
}

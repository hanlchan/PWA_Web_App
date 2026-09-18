import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PrivateWeightEntry = {
  id: string;
  weight_kg: number;
  measured_at: string;
  measurement_type: "morning" | "evening" | "custom";
  bmi: number | null;
};

export type PrivateWeightDashboard = {
  height_cm: number | null;
  entries: PrivateWeightEntry[];
};

export type PublicTrendPoint = { measured_date: string; normalized_index: number };

export async function getPrivateWeightDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_private_weight_dashboard");
  if (error) throw new Error("无法读取体重记录");
  return data as unknown as PrivateWeightDashboard;
}

export async function getPublicWeightTrend(username: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_weight_trend", { p_username: username });
  if (error) throw new Error("无法读取公开体重趋势");
  return (data ?? []) as unknown as PublicTrendPoint[];
}

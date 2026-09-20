import { createClient } from "@/lib/supabase/server";

export type Dashboard = { today:string; has_active_plans:boolean; today_occurrences:Array<{id:string;title:string;description:string|null;duration_minutes:number|null;scheduled_time:string|null;status:string}>; today_checkins:Array<{id:string;occurrence_id:string|null;checkin_date:string;duration_minutes:number|null}>; total_checkin_days:number; current_streak:number; unread_notifications:number };

export async function getTodayDashboard():Promise<Dashboard>{
  const supabase = await createClient();
  const [dashboardResult, plansResult] = await Promise.all([
    supabase.rpc("get_today_dashboard"),
    supabase.from("workout_plans").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);
  if(dashboardResult.error || !dashboardResult.data || plansResult.error) throw new Error("无法读取今日数据");
  return {
    ...(dashboardResult.data as unknown as Omit<Dashboard, "has_active_plans">),
    has_active_plans: (plansResult.count ?? 0) > 0,
  };
}

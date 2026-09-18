import { createClient } from "@/lib/supabase/server";

export type Dashboard = { today:string; today_occurrences:Array<{id:string;title:string;description:string|null;duration_minutes:number|null;scheduled_time:string|null;status:string}>; today_checkins:Array<{id:string;occurrence_id:string|null;checkin_date:string;duration_minutes:number|null}>; total_checkin_days:number; current_streak:number; unread_notifications:number };

export async function getTodayDashboard():Promise<Dashboard>{
  const {data,error}=await (await createClient()).rpc("get_today_dashboard");
  if(error||!data) throw new Error("无法读取今日数据");
  return data as unknown as Dashboard;
}

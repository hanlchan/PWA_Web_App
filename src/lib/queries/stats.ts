import { createClient } from "@/lib/supabase/server";
export type Stats={total_days:number;month_days:number;current_streak:number;completion_rate_30d:number;recorded_minutes:number|null};
export async function getStats(month:string){const supabase=await createClient();const [{data:stats,error},{data:calendar,error:calendarError}]=await Promise.all([supabase.rpc("get_user_stats",{p_month:month}),supabase.rpc("get_calendar_month",{p_month:month})]);if(error||calendarError)throw new Error("无法读取统计");return {stats:stats as unknown as Stats,calendar:calendar??[]};}

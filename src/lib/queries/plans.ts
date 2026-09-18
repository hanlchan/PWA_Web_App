import { createClient } from "@/lib/supabase/server";

export async function listPlans() {
  const { data, error } = await (await createClient()).from("workout_plans").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) throw new Error("无法读取计划");
  return data;
}

export async function getPlan(id: string) {
  const supabase = await createClient();
  const [{ data, error }, { data: customDates }] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("id", id).is("deleted_at", null).single(),
    supabase.from("plan_custom_dates").select("scheduled_date").eq("plan_id", id).order("scheduled_date"),
  ]);
  if (error) return null;
  return { ...data, custom_dates: customDates?.map(item => item.scheduled_date) ?? [] };
}

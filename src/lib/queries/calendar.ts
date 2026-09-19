import { getDateInTimeZone, isInBackfillWindow } from "@/lib/calendar/date";
import { createClient } from "@/lib/supabase/server";

export type CalendarDay = {
  date: string;
  today: string;
  timeZone: string;
  withinCheckinWindow: boolean;
  canBackfill: boolean;
  occurrences: Array<{
    id: string;
    plan_id: string;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    scheduled_time: string | null;
    status: string;
  }>;
  checkins: Array<{
    id: string;
    occurrence_id: string | null;
    completed_at: string;
    duration_minutes: number | null;
    activity_text: string | null;
    notes: string | null;
    is_backfilled: boolean;
  }>;
};

export async function getCalendarDay(date: string): Promise<CalendarDay> {
  const supabase = await createClient();
  const [occurrenceResult, checkinResult, settingsResult] = await Promise.all([
    supabase.from("plan_occurrences").select("id,plan_id,scheduled_time,status").eq("scheduled_date", date).order("scheduled_time"),
    supabase.from("checkins").select("id,occurrence_id,completed_at,duration_minutes,activity_text,notes,is_backfilled").eq("checkin_date", date).order("completed_at"),
    supabase.from("profile_settings").select("timezone").single(),
  ]);
  if (occurrenceResult.error || checkinResult.error || settingsResult.error || !settingsResult.data) {
    throw new Error("无法读取当天记录");
  }

  const planIds = [...new Set((occurrenceResult.data ?? []).map((item) => item.plan_id))];
  const planResult = planIds.length > 0
    ? await supabase.from("workout_plans").select("id,title,description,duration_minutes").in("id", planIds)
    : { data: [], error: null };
  if (planResult.error) throw new Error("无法读取当天计划");

  const plans = new Map((planResult.data ?? []).map((plan) => [plan.id, plan]));
  const today = getDateInTimeZone(new Date(), settingsResult.data.timezone);
  const withinCheckinWindow = isInBackfillWindow(date, today);
  return {
    date,
    today,
    timeZone: settingsResult.data.timezone,
    withinCheckinWindow,
    canBackfill: withinCheckinWindow && (checkinResult.data ?? []).length === 0,
    occurrences: (occurrenceResult.data ?? []).map((occurrence) => {
      const plan = plans.get(occurrence.plan_id);
      return {
        ...occurrence,
        title: plan?.title ?? "已删除的计划",
        description: plan?.description ?? null,
        duration_minutes: plan?.duration_minutes ?? null,
      };
    }),
    checkins: checkinResult.data ?? [],
  };
}

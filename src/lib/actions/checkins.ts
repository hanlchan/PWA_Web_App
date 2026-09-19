"use server";
import { revalidatePath } from "next/cache";
import { isValidIsoDate } from "@/lib/calendar/date";
import { createClient } from "@/lib/supabase/server";
import { checkinDetailsSchema } from "@/lib/validation/checkin";

function revalidateCheckinViews(date?: string) {
  revalidatePath("/");
  revalidatePath("/stats");
  if (date && isValidIsoDate(date)) revalidatePath(`/stats/${date}`);
}

export async function completeOccurrenceAction(form: FormData) {
  const id = String(form.get("occurrenceId") ?? "");
  if (!id) return;
  const { error } = await (await createClient()).rpc("complete_occurrence", { p_occurrence_id: id });
  if (error) throw new Error("打卡失败，请确认日期在允许范围内");
  revalidateCheckinViews(String(form.get("checkinDate") ?? ""));
}

export async function manualCheckinAction(form: FormData) {
  const date = String(form.get("checkinDate") ?? "");
  if (!isValidIsoDate(date)) throw new Error("打卡日期无效");
  const { error } = await (await createClient()).rpc("create_manual_checkin", { p_checkin_date: date, p_is_backfilled: false });
  if (error) throw new Error("打卡失败，请确认日期在过去 7 天内");
  revalidateCheckinViews(date);
}

export async function updateCheckinDetailsAction(form: FormData) {
  const parsed = checkinDetailsSchema.safeParse({
    checkinId: form.get("checkinId"),
    date: form.get("checkinDate"),
    durationMinutes: form.get("durationMinutes"),
    activityText: form.get("activityText"),
    notes: form.get("notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "记录内容无效");
  const { error } = await (await createClient()).rpc("update_checkin_details", {
    p_checkin_id: parsed.data.checkinId,
    p_duration_minutes: parsed.data.durationMinutes,
    p_activity_text: parsed.data.activityText,
    p_notes: parsed.data.notes,
  });
  if (error) throw new Error("补充记录保存失败");
  revalidateCheckinViews(parsed.data.date);
}

export async function undoCheckinAction(form: FormData) {
  const id = String(form.get("checkinId") ?? "");
  if (!id) return;
  const { error } = await (await createClient()).rpc("undo_checkin", { p_checkin_id: id });
  if (error) throw new Error("撤销失败，请重试");
  revalidateCheckinViews(String(form.get("checkinDate") ?? ""));
}

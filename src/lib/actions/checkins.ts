"use server";
import { revalidatePath } from "next/cache";
import { isValidIsoDate } from "@/lib/calendar/date";
import { createClient } from "@/lib/supabase/server";
import { checkinDetailsSchema } from "@/lib/validation/checkin";
import type { ActionResult } from "./result";

const success = (): ActionResult => ({ ok: true, data: undefined });
const failure = (message: string): ActionResult => ({ ok: false, message });

function revalidateCheckinViews(date?: string) {
  revalidatePath("/");
  revalidatePath("/stats");
  if (date && isValidIsoDate(date)) revalidatePath(`/stats/${date}`);
}

export async function completeOccurrenceAction(form: FormData): Promise<ActionResult> {
  const id = String(form.get("occurrenceId") ?? "");
  if (!id) return failure("计划编号无效");
  const { error } = await (await createClient()).rpc("complete_occurrence", { p_occurrence_id: id });
  if (error) return failure("打卡失败，请确认日期在允许范围内");
  revalidateCheckinViews(String(form.get("checkinDate") ?? ""));
  return success();
}

export async function manualCheckinAction(form: FormData): Promise<ActionResult> {
  const date = String(form.get("checkinDate") ?? "");
  if (!isValidIsoDate(date)) return failure("打卡日期无效");
  const { error } = await (await createClient()).rpc("create_manual_checkin", { p_checkin_date: date, p_is_backfilled: false });
  if (error) return failure("打卡失败，请确认日期在过去 7 天内");
  revalidateCheckinViews(date);
  return success();
}

export async function updateCheckinDetailsAction(form: FormData): Promise<ActionResult> {
  const parsed = checkinDetailsSchema.safeParse({
    checkinId: form.get("checkinId"),
    date: form.get("checkinDate"),
    durationMinutes: form.get("durationMinutes"),
    activityText: form.get("activityText"),
    notes: form.get("notes"),
  });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "记录内容无效");
  const { error } = await (await createClient()).rpc("update_checkin_details", {
    p_checkin_id: parsed.data.checkinId,
    p_duration_minutes: parsed.data.durationMinutes,
    p_activity_text: parsed.data.activityText,
    p_notes: parsed.data.notes,
  });
  if (error) return failure("补充记录保存失败");
  revalidateCheckinViews(parsed.data.date);
  return success();
}

export async function undoCheckinAction(form: FormData): Promise<ActionResult> {
  const id = String(form.get("checkinId") ?? "");
  if (!id) return failure("打卡记录编号无效");
  const { error } = await (await createClient()).rpc("undo_checkin", { p_checkin_id: id });
  if (error) return failure("撤销失败，请重试");
  revalidateCheckinViews(String(form.get("checkinDate") ?? ""));
  return success();
}

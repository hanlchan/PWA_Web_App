"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planSchema, type PlanInput } from "@/lib/validation/plan";
import type { Json } from "@/lib/types/database";
import type { ActionResult } from "./result";

function payloadFromForm(form: FormData) {
  const recurrenceType = String(form.get("recurrenceType"));
  const common = {
    title: form.get("title"), description: form.get("description"),
    durationMinutes: form.get("durationMinutes") ? Number(form.get("durationMinutes")) : null,
    startDate: form.get("startDate"), endDate: form.get("endDate") || null,
    startTime: form.get("startTime") || null, reminderEnabled: form.get("reminderEnabled") === "on",
    notes: form.get("notes"), recurrenceType,
  };
  if (recurrenceType === "weekly") return { ...common, daysOfWeek: form.getAll("daysOfWeek").map(Number) };
  if (recurrenceType === "monthly") return { ...common, daysOfMonth: form.getAll("daysOfMonth").map(Number) };
  if (recurrenceType === "custom_dates") return { ...common, customDates: String(form.get("customDates") ?? "").split(",").map(v => v.trim()).filter(Boolean) };
  return common;
}

async function persist(mode: "create" | "update", form: FormData): Promise<ActionResult> {
  const parsed = planSchema.safeParse(payloadFromForm(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "请检查计划内容" };
  const supabase = await createClient();
  const call = mode === "create"
    ? supabase.rpc("create_workout_plan", { p_payload: parsed.data as PlanInput as unknown as Json })
    : supabase.rpc("update_workout_plan", { p_plan_id: String(form.get("planId")), p_payload: parsed.data as PlanInput as unknown as Json });
  const { error } = await call;
  if (error) return { ok: false, message: "计划保存失败，请稍后重试" };
  revalidatePath("/"); revalidatePath("/plans"); revalidatePath("/stats");
  redirect("/plans");
}

export async function createPlanAction(_: ActionResult, form: FormData) { return persist("create", form); }
export async function updatePlanAction(_: ActionResult, form: FormData) { return persist("update", form); }
export async function deletePlanAction(form: FormData) {
  const id = String(form.get("planId") ?? "");
  if (!id) return;
  const { error } = await (await createClient()).rpc("delete_workout_plan", { p_plan_id: id });
  if (!error) { revalidatePath("/"); revalidatePath("/plans"); redirect("/plans"); }
}

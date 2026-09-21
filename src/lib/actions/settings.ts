"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/profile";
import type { ActionResult } from "./result";

export async function updateSettingsAction(form: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    username: form.get("username"), displayName: form.get("displayName"),
    heightCm: form.get("heightCm"), timezone: form.get("timezone"),
    avatarPath: form.get("avatarPath") || null,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "资料无效" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName, avatar_path: parsed.data.avatarPath ?? null,
  }).eq("id", user.id);
  if (error) return { ok: false, message: "资料更新失败" };

  const photoDefaultVisibility = form.get("photoDefaultVisibility") === "public" ? "public" : "private";
  const { error: settingsError } = await supabase.from("profile_settings").update({
    height_cm: parsed.data.heightCm,
    timezone: parsed.data.timezone,
    public_weight_trend: form.get("publicWeightTrend") === "on",
    public_workout_details: form.get("publicWorkoutDetails") === "on",
    photo_default_visibility: photoDefaultVisibility,
  }).eq("user_id", user.id);
  if (settingsError) return { ok: false, message: "设置更新失败" };
  const { error: reminderError } = await supabase.rpc("reschedule_future_notifications", { p_user_id: user.id });
  if (reminderError) return { ok: false, message: "提醒时间更新失败" };
  revalidatePath("/me"); revalidatePath("/settings"); revalidatePath(`/u/${parsed.data.username}`);
  redirect("/me");
}

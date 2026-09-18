"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/profile";
import type { ActionResult } from "./result";

export async function completeProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "请检查资料" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "登录已失效，请重新登录" };
  const { error } = await supabase.rpc("complete_onboarding", {
    p_username: parsed.data.username,
    p_display_name: parsed.data.displayName,
    p_height_cm: parsed.data.heightCm,
    p_timezone: parsed.data.timezone,
    p_avatar_path: parsed.data.avatarPath ?? null,
  });
  if (error) return { ok: false, message: error.code === "23505" ? "用户名已被使用" : "资料保存失败，请稍后重试" };
  redirect("/");
}

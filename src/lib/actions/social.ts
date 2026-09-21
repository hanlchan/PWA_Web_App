"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { socialIdSchema } from "@/lib/validation/social";
import type { ActionResult } from "./result";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function toggleFollowAction(form: FormData): Promise<ActionResult> {
  const parsed = socialIdSchema.safeParse(form.get("targetId"));
  if (!parsed.success) return { ok: false, message: "用户编号无效" };
  const id = parsed.data;
  const { error } = await (await authenticatedClient()).rpc("toggle_follow", { p_target_id: id });
  if (error) return { ok: false, message: "关注操作失败" };
  revalidatePath("/feed");
  return { ok: true, data: undefined };
}

export async function toggleLikeAction(form: FormData): Promise<ActionResult> {
  const parsed = socialIdSchema.safeParse(form.get("checkinId"));
  if (!parsed.success) return { ok: false, message: "打卡编号无效" };
  const id = parsed.data;
  const { error } = await (await authenticatedClient()).rpc("toggle_checkin_like", { p_checkin_id: id });
  if (error) return { ok: false, message: "点赞失败" };
  revalidatePath("/feed"); revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

export async function sendNudgeAction(form: FormData): Promise<ActionResult> {
  const parsed = socialIdSchema.safeParse(form.get("targetId"));
  if (!parsed.success) return { ok: false, message: "用户编号无效" };
  const id = parsed.data;
  const { error } = await (await authenticatedClient()).rpc("send_nudge", { p_target_id: id });
  if (error) return { ok: false, message: error.code === "23505" ? "今天已经催过 TA 了" : "暂时不能催 TA" };
  revalidatePath("/feed"); revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  const { error } = await (await authenticatedClient()).rpc("mark_notifications_read");
  if (error) return { ok: false, message: "通知更新失败" };
  revalidatePath("/notifications"); revalidatePath("/");
  return { ok: true, data: undefined };
}

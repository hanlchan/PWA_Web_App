"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { socialIdSchema } from "@/lib/validation/social";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function toggleFollowAction(form: FormData) {
  const id = socialIdSchema.parse(form.get("targetId"));
  const { error } = await (await authenticatedClient()).rpc("toggle_follow", { p_target_id: id });
  if (error) throw new Error("关注操作失败");
  revalidatePath("/feed");
}

export async function toggleLikeAction(form: FormData) {
  const id = socialIdSchema.parse(form.get("checkinId"));
  const { error } = await (await authenticatedClient()).rpc("toggle_checkin_like", { p_checkin_id: id });
  if (error) throw new Error("点赞失败");
  revalidatePath("/feed"); revalidatePath("/notifications");
}

export async function sendNudgeAction(form: FormData) {
  const id = socialIdSchema.parse(form.get("targetId"));
  const { error } = await (await authenticatedClient()).rpc("send_nudge", { p_target_id: id });
  if (error) throw new Error(error.code === "23505" ? "今天已经催过 TA 了" : "暂时不能催 TA");
  revalidatePath("/feed"); revalidatePath("/notifications");
}

export async function markNotificationsReadAction() {
  const { error } = await (await authenticatedClient()).rpc("mark_notifications_read");
  if (error) throw new Error("通知更新失败");
  revalidatePath("/notifications"); revalidatePath("/");
}

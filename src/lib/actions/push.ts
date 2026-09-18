"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pushSubscriptionSchema } from "@/lib/validation/push";
import type { ActionResult } from "./result";

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "推送订阅数据无效" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "登录已失效" };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth, p_user_agent: parsed.data.userAgent,
  });
  if (error) return { ok: false, message: "提醒订阅保存失败" };
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  if (!zUrl(endpoint)) return { ok: false, message: "订阅地址无效" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("remove_push_subscription", { p_endpoint: endpoint });
  if (error) return { ok: false, message: "关闭提醒失败" };
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

function zUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; }
}

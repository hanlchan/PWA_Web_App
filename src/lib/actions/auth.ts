"use server";

import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import type { ActionResult } from "./result";

const failure = (message: string): ActionResult => ({ ok: false, message });

export async function loginAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "请检查输入");
  const { error } = await (await createClient()).auth.signInWithPassword(parsed.data);
  if (error) return failure("邮箱或密码不正确");
  redirect("/");
}

export async function registerAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "请检查输入");
  const { error } = await (await createClient()).auth.signUp({ email: parsed.data.email, password: parsed.data.password });
  if (error) return failure(error.message.includes("registered") ? "该邮箱已注册" : "注册失败，请稍后重试");
  redirect("/onboarding");
}

export async function forgotPasswordAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "请输入有效邮箱");
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  const { error } = await (await createClient()).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error) return failure("发送失败，请稍后重试");
  return { ok: true, data: undefined };
}

export async function resetPasswordAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "请检查输入");
  const { error } = await (await createClient()).auth.updateUser({ password: parsed.data.password });
  if (error) return failure("密码更新失败，请重新打开邮件链接");
  redirect("/login?reset=success");
}

export async function logoutAction() {
  await (await createClient()).auth.signOut();
  redirect("/login");
}

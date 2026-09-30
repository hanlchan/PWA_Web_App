"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { syncSessionAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/cloudbase/client";

type Mode = "login" | "register" | "forgot" | "reset";
type Session = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user: { id: string };
};
type VerifyOtp = (params: { token: string | number }) => Promise<{ data: { session?: Session | null }; error: { message: string } | null }>;
type UpdatePassword = (params: { nonce: string; password: string }) => Promise<{ data: { session?: Session | null }; error: { message: string } | null }>;

function sessionPayload(session: Session) {
  if (!session.access_token || !session.refresh_token || !session.expires_in) return null;
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in };
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const verifyOtp = useRef<VerifyOtp | null>(null);
  const updatePassword = useRef<UpdatePassword | null>(null);
  const [step, setStep] = useState<"credentials" | "verify" | "reset">("credentials");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const effectiveMode = mode === "reset" ? "forgot" : mode;

  async function persistAndNavigate(session: Session, destination: string) {
    const payload = sessionPayload(session);
    if (!payload) throw new Error("CloudBase 未返回完整会话");
    const result = await syncSessionAction(payload);
    if (!result.ok) throw new Error(result.message);
    router.replace(destination);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    try {
      const auth = createClient().auth;
      if (effectiveMode === "login") {
        const result = await auth.signInWithPassword({ email: String(form.get("email")), password });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.session) throw new Error("CloudBase 未建立登录会话");
        await persistAndNavigate(result.data.session, "/");
      } else if (effectiveMode === "register" && step === "credentials") {
        if (password !== confirmPassword) throw new Error("两次密码不一致");
        const currentEmail = String(form.get("email"));
        const result = await auth.signUp({ email: currentEmail, password });
        if (result.error) throw new Error(result.error.message);
        if (result.data.session) return await persistAndNavigate(result.data.session, "/onboarding");
        if (!result.data.verifyOtp) throw new Error("CloudBase 未返回验证码校验流程");
        verifyOtp.current = result.data.verifyOtp as VerifyOtp;
        setEmail(currentEmail);
        setStep("verify");
        setMessage("验证码已发送，请检查邮箱。");
      } else if (effectiveMode === "register" && step === "verify") {
        const result = await verifyOtp.current?.({ token: String(form.get("otp")) });
        if (!result) throw new Error("验证码会话已失效，请重新注册");
        if (result.error) throw new Error(result.error.message);
        if (!result.data.session) throw new Error("CloudBase 未建立注册会话");
        await persistAndNavigate(result.data.session, "/onboarding");
      } else if (effectiveMode === "forgot" && step === "credentials") {
        const currentEmail = String(form.get("email"));
        const result = await auth.resetPasswordForEmail(currentEmail);
        if (result.error) throw new Error(result.error.message);
        if (!result.data.updateUser) throw new Error("CloudBase 未返回密码重置流程");
        updatePassword.current = result.data.updateUser as UpdatePassword;
        setEmail(currentEmail);
        setStep("reset");
        setMessage("验证码已发送，请输入验证码并设置新密码。");
      } else if (effectiveMode === "forgot" && step === "reset") {
        if (password !== confirmPassword) throw new Error("两次密码不一致");
        const result = await updatePassword.current?.({ nonce: String(form.get("otp")), password });
        if (!result) throw new Error("密码重置会话已失效，请重新发送验证码");
        if (result.error) throw new Error(result.error.message);
        if (result.data.session) {
          const payload = sessionPayload(result.data.session);
          if (payload) await syncSessionAction(payload);
        }
        router.replace("/login?reset=success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setPending(false);
    }
  }

  const showEmail = step === "credentials";
  const showOtp = step === "verify" || step === "reset";
  const showPassword = effectiveMode === "login" || effectiveMode === "register" && step === "credentials" || step === "reset";
  const showConfirm = effectiveMode === "register" && step === "credentials" || step === "reset";
  const titles = { login: "欢迎回来", register: "创建账号", forgot: "找回密码", reset: "找回密码" };
  const button = step === "verify" ? "验证并注册" : step === "reset" ? "更新密码" : ({ login: "登录", register: "发送注册验证码", forgot: "发送重置验证码", reset: "发送重置验证码" }[mode]);

  return <main className="min-h-dvh bg-emerald-50 px-5 py-12 text-slate-900">
    <section className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-xl shadow-emerald-900/10">
      <p className="text-sm font-semibold text-emerald-600">运动打卡</p>
      <h1 className="mt-2 text-2xl font-bold">{titles[mode]}</h1>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {showEmail && <label className="block text-sm font-medium">邮箱<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {!showEmail && email && <p className="text-sm text-slate-500">验证码已发送至 {email}</p>}
        {showOtp && <label className="block text-sm font-medium">邮箱验证码<input name="otp" inputMode="numeric" autoComplete="one-time-code" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {showPassword && <label className="block text-sm font-medium">密码<input name="password" type="password" autoComplete={effectiveMode === "login" ? "current-password" : "new-password"} required minLength={8} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {showConfirm && <label className="block text-sm font-medium">确认密码<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {message && <p role={message.includes("已发送") ? "status" : "alert"} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white disabled:opacity-60">{pending ? "处理中…" : button}</button>
      </form>
      <div className="mt-5 flex justify-between text-sm text-slate-600">
        {mode === "login" && <><Link href="/register">注册账号</Link><Link href="/forgot-password">忘记密码</Link></>}
        {mode !== "login" && <Link href="/login">返回登录</Link>}
      </div>
    </section>
  </main>;
}

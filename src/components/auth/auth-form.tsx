"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions/result";

type Mode = "login" | "register" | "forgot" | "reset";
type Props = { mode: Mode; action: (state: ActionResult, data: FormData) => Promise<ActionResult> };
const initial: ActionResult = { ok: false, message: "" };

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const isEmail = mode !== "reset";
  const isPassword = mode !== "forgot";
  return <main className="min-h-dvh bg-emerald-50 px-5 py-12 text-slate-900">
    <section className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-xl shadow-emerald-900/10">
      <p className="text-sm font-semibold text-emerald-600">好友运动打卡</p>
      <h1 className="mt-2 text-2xl font-bold">{{ login:"欢迎回来", register:"创建账号", forgot:"找回密码", reset:"设置新密码" }[mode]}</h1>
      <form action={formAction} className="mt-7 space-y-4">
        {isEmail && <label className="block text-sm font-medium">邮箱<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {isPassword && <label className="block text-sm font-medium">密码<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {(mode === "register" || mode === "reset") && <label className="block text-sm font-medium">确认密码<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>}
        {!state.ok && state.message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.message}</p>}
        {state.ok && mode === "forgot" && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">重置邮件已发送，请检查邮箱。</p>}
        <button disabled={pending} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white disabled:opacity-60">{pending ? "处理中…" : ({ login:"登录", register:"注册", forgot:"发送重置邮件", reset:"更新密码" }[mode])}</button>
      </form>
      <div className="mt-5 flex justify-between text-sm text-slate-600">
        {mode === "login" && <><Link href="/register">注册账号</Link><Link href="/forgot-password">忘记密码</Link></>}
        {mode !== "login" && <Link href="/login">返回登录</Link>}
      </div>
    </section>
  </main>;
}

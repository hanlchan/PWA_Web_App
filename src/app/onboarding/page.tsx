import { OnboardingForm } from "@/components/auth/onboarding-form";

export default function OnboardingPage() {
  return <main className="min-h-dvh bg-emerald-50 px-5 py-10 text-slate-900"><section className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-xl shadow-emerald-900/10"><p className="text-sm font-semibold text-emerald-600">只差一步</p><h1 className="mt-2 text-2xl font-bold">设置个人资料</h1><p className="mt-2 text-sm text-slate-500">不会为你生成任何默认运动计划。</p><OnboardingForm /></section></main>;
}

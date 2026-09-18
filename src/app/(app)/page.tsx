import Link from "next/link";

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  return <main><p className="text-sm text-slate-500">{today}</p><h1 className="mt-1 text-3xl font-bold">今天，动一下</h1><section className="mt-8 rounded-3xl bg-white p-7 text-center shadow-sm"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">🌱</div><h2 className="mt-4 text-lg font-bold">你还没有安排运动计划</h2><p className="mt-2 text-sm leading-6 text-slate-500">所有运动日期和时间都由你自己决定。</p><Link href="/plans/new" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">创建第一个计划</Link></section><button className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold text-slate-700">临时打卡</button></main>;
}

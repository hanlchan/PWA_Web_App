import Link from "next/link";
import { listPlans } from "@/lib/queries/plans";

export default async function PlansPage(){
  const plans=await listPlans();
  return <main><div className="flex items-center justify-between"><h1 className="text-2xl font-bold">我的计划</h1><Link href="/plans/new" className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-white">新建</Link></div>{plans.length===0?<section className="mt-8 rounded-3xl bg-white p-7 text-center"><p className="font-bold">还没有运动计划</p><p className="mt-2 text-sm text-slate-500">按照自己的节奏安排即可。</p></section>:<div className="mt-6 space-y-3">{plans.map(plan=><Link key={plan.id} href={`/plans/${plan.id}`} className="block rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="font-bold">{plan.title}</h2><span className="text-sm text-slate-500">{plan.start_time?.slice(0,5) ?? "未设时间"}</span></div><p className="mt-2 text-sm text-slate-500">{{one_time:"单次",weekly:"每周",monthly:"每月",custom_dates:"自定义日期"}[plan.recurrence_type]}</p></Link>)}</div>}</main>;
}

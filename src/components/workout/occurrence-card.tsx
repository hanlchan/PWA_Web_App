import { completeOccurrenceAction, undoCheckinAction } from "@/lib/actions/checkins";
import type { Dashboard } from "@/lib/queries/dashboard";

export function OccurrenceCard({occurrence,checkin}:{occurrence:Dashboard["today_occurrences"][number];checkin?:Dashboard["today_checkins"][number]}){
  const done=occurrence.status==="completed";
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="font-bold">{occurrence.title}</h2><span className="text-sm text-slate-500">{occurrence.scheduled_time?.slice(0,5)??"未设时间"}</span></div>{occurrence.duration_minutes&&<p className="mt-2 text-sm text-slate-500">预计 {occurrence.duration_minutes} 分钟</p>}{done&&checkin?<form action={undoCheckinAction} className="mt-4"><input type="hidden" name="checkinId" value={checkin.id}/><button className="w-full rounded-xl bg-emerald-50 px-4 py-3 font-bold text-emerald-700">✓ 已完成 · 撤销</button></form>:<form action={completeOccurrenceAction} className="mt-4"><input type="hidden" name="occurrenceId" value={occurrence.id}/><button className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white">✓ 完成今日运动</button></form>}</article>;
}

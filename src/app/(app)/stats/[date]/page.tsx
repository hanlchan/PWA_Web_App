import Link from "next/link";
import { notFound } from "next/navigation";

import { completeOccurrenceAction, manualCheckinAction, undoCheckinAction, updateCheckinDetailsAction } from "@/lib/actions/checkins";
import { isValidIsoDate } from "@/lib/calendar/date";
import { getCalendarDay } from "@/lib/queries/calendar";
import { ActionStateForm, PendingSubmitButton } from "@/components/forms/action-state-form";

export default async function CalendarDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const day = await getCalendarDay(date);
  const label = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));

  return <main>
    <Link href="/stats" className="text-sm font-semibold text-emerald-700">← 返回月历</Link>
    <div className="mt-4 flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{label}</h1><p className="mt-1 text-sm text-slate-500">查看当天计划和运动记录</p></div><Link href={`/plans/new?date=${date}`} className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold">新增计划</Link></div>

    <h2 className="mb-3 mt-7 text-lg font-bold">当天计划</h2>
    <section className="space-y-3">
      {day.occurrences.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">当天没有安排运动计划。</p>}
      {day.occurrences.map((occurrence) => {
        const checkin = day.checkins.find((item) => item.occurrence_id === occurrence.id);
        const canComplete = !checkin && occurrence.status === "pending" && day.withinCheckinWindow;
        const pendingLabel = occurrence.status === "cancelled" ? "已取消" : occurrence.status === "skipped" ? "已跳过" : date > day.today ? "未来计划" : "不在补录期限内";
        return <article key={occurrence.id} className="rounded-2xl bg-white p-5">
          <div className="flex justify-between gap-3"><div><h3 className="font-bold">{occurrence.title}</h3>{occurrence.description && <p className="mt-1 text-sm text-slate-500">{occurrence.description}</p>}</div><span className="shrink-0 text-sm text-slate-500">{occurrence.scheduled_time?.slice(0,5) ?? "未设时间"}</span></div>
          {occurrence.duration_minutes && <p className="mt-2 text-xs text-slate-500">预计 {occurrence.duration_minutes} 分钟</p>}
          <div className="mt-4 flex items-center gap-3"><Link href={`/plans/${occurrence.plan_id}`} className="text-sm font-semibold text-slate-600">编辑计划</Link>{checkin ? <span className="ml-auto text-sm font-bold text-emerald-600">✓ 已完成</span> : canComplete ? <ActionStateForm action={completeOccurrenceAction} className="ml-auto"><input type="hidden" name="occurrenceId" value={occurrence.id}/><input type="hidden" name="checkinDate" value={date}/><PendingSubmitButton pendingLabel="打卡中…" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">完成这项计划</PendingSubmitButton></ActionStateForm> : <span className="ml-auto text-sm text-slate-400">{pendingLabel}</span>}</div>
        </article>;
      })}
    </section>

    {day.canBackfill && <ActionStateForm action={manualCheckinAction} className="mt-4"><input type="hidden" name="checkinDate" value={date}/><PendingSubmitButton pendingLabel="打卡中…" className="w-full rounded-2xl border border-sky-200 bg-white px-4 py-4 font-semibold text-sky-700 disabled:opacity-50">{date === day.today ? "临时打卡" : "补录当天运动"}</PendingSubmitButton></ActionStateForm>}

    <h2 className="mb-3 mt-7 text-lg font-bold">运动记录</h2>
    <section className="space-y-3">
      {day.checkins.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">当天还没有运动记录。</p>}
      {day.checkins.map((checkin) => <article key={checkin.id} className="rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between gap-3"><p className="font-bold">{checkin.occurrence_id ? "计划打卡" : "临时打卡"}{checkin.is_backfilled ? " · 补录" : ""}</p><time className="text-xs text-slate-400">{new Date(checkin.completed_at).toLocaleTimeString("zh-CN", {hour:"2-digit",minute:"2-digit",timeZone:day.timeZone})}</time></div>
        {(checkin.duration_minutes || checkin.activity_text || checkin.notes) && <div className="mt-3 space-y-1 text-sm text-slate-600">{checkin.duration_minutes && <p>{checkin.duration_minutes} 分钟</p>}{checkin.activity_text && <p>{checkin.activity_text}</p>}{checkin.notes && <p>{checkin.notes}</p>}</div>}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-700">补充记录</summary><ActionStateForm action={updateCheckinDetailsAction} className="mt-3 space-y-3"><input type="hidden" name="checkinId" value={checkin.id}/><input type="hidden" name="checkinDate" value={date}/><label className="block text-sm">实际分钟（可选）<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={checkin.duration_minutes ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/></label><label className="block text-sm">运动内容（可选）<input name="activityText" maxLength={500} defaultValue={checkin.activity_text ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"/></label><label className="block text-sm">备注（可选）<textarea name="notes" maxLength={2000} defaultValue={checkin.notes ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2"/></label><PendingSubmitButton pendingLabel="保存中…" className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">保存补充记录</PendingSubmitButton></ActionStateForm></details>
        <ActionStateForm action={undoCheckinAction} className="mt-3"><input type="hidden" name="checkinId" value={checkin.id}/><input type="hidden" name="checkinDate" value={date}/><PendingSubmitButton pendingLabel="撤销中…" className="min-h-11 text-sm font-semibold text-rose-600 disabled:opacity-50">撤销这次打卡</PendingSubmitButton></ActionStateForm>
      </article>)}
    </section>
  </main>;
}

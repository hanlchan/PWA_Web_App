import Link from "next/link";
import { manualCheckinAction, undoCheckinAction } from "@/lib/actions/checkins";
import { OccurrenceCard } from "@/components/workout/occurrence-card";
import { getTodayDashboard } from "@/lib/queries/dashboard";
import { ActionStateForm, PendingSubmitButton } from "@/components/forms/action-state-form";

export default async function DashboardPage() {
  const dashboard = await getTodayDashboard();
  const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const manual = dashboard.today_checkins.find((item) => !item.occurrence_id);

  return <main>
    <p className="text-sm text-slate-500">{today}</p>
    <h1 className="mt-1 text-3xl font-bold">今天，动一下</h1>
    <div className="mt-8 space-y-3">
      {dashboard.today_occurrences.length === 0 && (dashboard.has_active_plans
        ? <section className="rounded-3xl bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">📅</div>
            <h2 className="mt-4 text-lg font-bold">今天没有安排打卡</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">你已创建运动计划，到了计划日期会显示在这里。</p>
            <Link href="/plans" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">查看我的计划</Link>
          </section>
        : <section className="rounded-3xl bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">🌱</div>
            <h2 className="mt-4 text-lg font-bold">你还没有安排运动计划</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">所有运动日期和时间都由你自己决定。</p>
            <Link href="/plans/new" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">创建第一个计划</Link>
          </section>)}
      {dashboard.today_occurrences.map((item) => <OccurrenceCard key={item.id} occurrence={item} checkin={dashboard.today_checkins.find((checkin) => checkin.occurrence_id === item.id)} />)}
    </div>
    {manual
      ? <ActionStateForm action={undoCheckinAction} className="mt-4"><input type="hidden" name="checkinId" value={manual.id}/><PendingSubmitButton pendingLabel="撤销中…" className="w-full rounded-2xl bg-emerald-50 px-4 py-4 font-semibold text-emerald-700 disabled:opacity-50">✓ 今日已临时打卡 · 撤销</PendingSubmitButton></ActionStateForm>
      : <ActionStateForm action={manualCheckinAction} className="mt-4"><input type="hidden" name="checkinDate" value={dashboard.today}/><PendingSubmitButton pendingLabel="打卡中…" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold text-slate-700 disabled:opacity-50">临时打卡</PendingSubmitButton></ActionStateForm>}
    <div className="mt-6 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-white p-4"><span className="text-sm text-slate-500">累计打卡</span><p className="mt-1 text-2xl font-bold">{dashboard.total_checkin_days} 天</p></div>
      <div className="rounded-2xl bg-white p-4"><span className="text-sm text-slate-500">连续计划完成</span><p className="mt-1 text-2xl font-bold">{dashboard.current_streak} 日</p></div>
    </div>
  </main>;
}

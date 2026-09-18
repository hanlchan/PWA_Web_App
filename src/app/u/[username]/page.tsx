import Image from "next/image";
import { notFound } from "next/navigation";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import { TrendChart } from "@/components/stats/trend-chart";
import { getPublicProfile } from "@/lib/queries/public-profile";
import { getPublicWeightTrend } from "@/lib/queries/weights";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [profile, weightTrend] = await Promise.all([
    getPublicProfile(username, month),
    getPublicWeightTrend(username),
  ]);
  if (!profile) notFound();

  const avatar = profile.avatar_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_path}`
    : null;
  const entries = profile.checkin_dates.map((scheduled_date) => ({
    scheduled_date,
    state: "manual_completed",
  }));

  return (
    <main className="min-h-dvh bg-emerald-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
          {avatar ? (
            <Image unoptimized src={avatar} alt={`${profile.display_name}的头像`} width={80} height={80} className="mx-auto size-20 rounded-full object-cover" />
          ) : (
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-3xl">🌱</div>
          )}
          <h1 className="mt-4 text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-slate-500">@{profile.username}</p>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["累计打卡", `${profile.total_checkin_days} 天`],
            ["本月", `${profile.month_checkin_days} 天`],
            ["连续完成", `${profile.current_streak} 日`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-3 text-center">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-bold">{value}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-7 text-lg font-bold">公开打卡日历</h2>
        <MonthCalendar month={month.slice(0, 7)} entries={entries} />
        {weightTrend.length >= 2 && (
          <section className="mt-6 rounded-3xl bg-white p-5">
            <h2 className="font-bold">体重变化趋势</h2>
            <p className="mt-1 text-xs text-slate-500">仅显示相对变化，不包含真实体重或 Y 轴数值。</p>
            <div className="mt-4"><TrendChart points={weightTrend.map((point) => ({ label: point.measured_date, value: point.normalized_index }))} /></div>
          </section>
        )}
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          这里只展示打卡日期和汇总，不展示邮箱、体重、身高、备注或私人运动详情。
        </p>
      </div>
    </main>
  );
}

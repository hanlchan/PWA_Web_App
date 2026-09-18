import { TrendChart } from "@/components/stats/trend-chart";
import { createWeightEntryAction, deleteWeightEntryAction } from "@/lib/actions/weights";
import { getPrivateWeightDashboard } from "@/lib/queries/weights";

const typeLabels = { morning: "晨间", evening: "晚间", custom: "自定义" } as const;

export default async function WeightPage() {
  const data = await getPrivateWeightDashboard();
  const latest = data.entries.at(-1);
  const now = new Date();
  const localDefault = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <main>
      <h1 className="text-2xl font-bold">体重记录</h1>
      <p className="mt-2 text-sm text-slate-500">真实体重仅你本人可见，并由数据库 RLS 强制保护。</p>

      <section className="mt-6 rounded-3xl bg-white p-5">
        <p className="text-sm text-slate-500">当前体重</p>
        <p className="mt-1 text-3xl font-bold">{latest ? `${latest.weight_kg} kg` : "暂无记录"}</p>
        {latest?.bmi != null ? <p className="mt-1 text-sm text-slate-500">BMI {latest.bmi}</p> : <p className="mt-1 text-xs text-slate-400">填写身高后可计算 BMI</p>}
        <div className="mt-4"><TrendChart privateValues points={data.entries.map((entry) => ({ label: new Date(entry.measured_at).toLocaleDateString("zh-CN"), value: entry.weight_kg }))} /></div>
      </section>

      <form action={createWeightEntryAction} className="mt-4 space-y-4 rounded-3xl bg-white p-5">
        <h2 className="font-bold">新增记录</h2>
        <label className="block text-sm font-medium">体重 kg<input name="weightKg" type="number" min="20" max="500" step="0.01" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="block text-sm font-medium">记录时间<input name="measuredAt" type="datetime-local" required defaultValue={localDefault} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="block text-sm font-medium">记录类型<select name="measurementType" defaultValue="custom" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="morning">晨间</option><option value="evening">晚间</option><option value="custom">自定义</option></select></label>
        <button className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white">保存体重</button>
      </form>

      <section className="mt-6 space-y-2">
        <h2 className="font-bold">历史记录</h2>
        {[...data.entries].reverse().map((entry) => <article key={entry.id} className="flex items-center justify-between rounded-2xl bg-white p-4"><div><p className="font-bold">{entry.weight_kg} kg</p><p className="text-xs text-slate-500">{new Date(entry.measured_at).toLocaleString("zh-CN")} · {typeLabels[entry.measurement_type]}{entry.bmi != null ? ` · BMI ${entry.bmi}` : ""}</p></div><form action={deleteWeightEntryAction}><input type="hidden" name="entryId" value={entry.id}/><button className="min-h-11 px-3 text-sm text-rose-600">删除</button></form></article>)}
      </section>
    </main>
  );
}

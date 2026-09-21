import { updateSettingsAction } from "@/lib/actions/settings";
import { getPrivateProfile } from "@/lib/queries/profile";
import { PushSettings } from "@/components/pwa/push-settings";
import { ActionStateForm, PendingSubmitButton } from "@/components/forms/action-state-form";

export default async function SettingsPage() {
  const data = await getPrivateProfile();
  if (!data) return null;
  return (
    <main>
      <h1 className="text-2xl font-bold">个人设置</h1>
      <ActionStateForm action={updateSettingsAction} className="mt-6 space-y-4">
        <input type="hidden" name="avatarPath" value={data.profile.avatar_path ?? ""} />
        <label className="block text-sm font-medium">用户名<input name="username" value={data.profile.username} readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label>
        <label className="block text-sm font-medium">昵称<input name="displayName" required defaultValue={data.profile.display_name} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" /></label>
        <label className="block text-sm font-medium">身高 cm（可选）<input name="heightCm" type="number" min="50" max="300" step="0.1" defaultValue={data.settings.height_cm ?? ""} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" /></label>
        <label className="block text-sm font-medium">时区<input name="timezone" required defaultValue={data.settings.timezone} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" /></label>
        <fieldset className="space-y-3 rounded-2xl bg-white p-4">
          <legend className="font-bold">公开范围</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="publicWeightTrend" defaultChecked={data.settings.public_weight_trend} className="size-5" /><span>公开体重变化趋势<br/><span className="text-xs text-slate-500">只公开归一化曲线，绝不公开公斤数</span></span></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="publicWorkoutDetails" defaultChecked={data.settings.public_workout_details} className="size-5" /><span>公开运动详情</span></label>
          <label className="block text-sm font-medium">照片默认范围<select name="photoDefaultVisibility" defaultValue={data.settings.photo_default_visibility} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="private">仅自己</option><option value="public">公开</option></select></label>
        </fieldset>
        <PendingSubmitButton pendingLabel="保存中…" className="w-full rounded-xl bg-slate-900 px-4 py-4 font-bold text-white disabled:opacity-50">保存设置</PendingSubmitButton>
      </ActionStateForm><PushSettings />
    </main>
  );
}

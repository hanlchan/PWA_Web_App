"use client";

import { useState, useTransition } from "react";
import { completeProfileAction } from "@/lib/actions/profile";
import { prepareAvatar } from "@/lib/images/avatar";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  return <form className="mt-7 space-y-4" onSubmit={(event) => {
    event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget);
    startTransition(async () => {
      let avatarPath: string | null = null;
      try {
        const avatar = form.get("avatar");
        if (avatar instanceof File && avatar.size) {
          const prepared = await prepareAvatar(avatar);
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("登录已失效");
          avatarPath = `${user.id}/avatar-${crypto.randomUUID()}.webp`;
          const { error } = await supabase.storage.from("avatars").upload(avatarPath, prepared, { contentType: "image/webp" });
          if (error) throw new Error("头像上传失败");
        }
        const result = await completeProfileAction({ username: form.get("username"), displayName: form.get("displayName"), heightCm: form.get("heightCm"), timezone: form.get("timezone"), avatarPath });
        if (!result.ok) { if (avatarPath) await createClient().storage.from("avatars").remove([avatarPath]); setMessage(result.message); }
      } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    });
  }}>
    <label className="block text-sm font-medium">用户名<input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9_]{1,28}[a-z0-9]" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="hanchan" /></label>
    <label className="block text-sm font-medium">昵称<input name="displayName" required maxLength={50} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
    <label className="block text-sm font-medium">身高 cm（可选）<input name="heightCm" type="number" min="50" max="300" step="0.1" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
    <label className="block text-sm font-medium">所在时区<input name="timezone" defaultValue={timezone} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
    <label className="block text-sm font-medium">头像（可选）<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm" /></label>
    {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white disabled:opacity-60">{pending ? "保存中…" : "完成设置"}</button>
  </form>;
}

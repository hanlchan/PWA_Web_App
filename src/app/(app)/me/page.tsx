import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "@/lib/actions/auth";
import { getPrivateProfile } from "@/lib/queries/profile";
import { ActionStateForm, PendingSubmitButton } from "@/components/forms/action-state-form";

export default async function MePage() {
  const data = await getPrivateProfile();
  if (!data) return null;

  const avatar = data.profile.avatar_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${data.profile.avatar_path}`
    : null;

  return (
    <main>
      <h1 className="text-2xl font-bold">我的</h1>
      <section className="mt-6 rounded-3xl bg-white p-6 text-center">
        {avatar ? (
          <Image unoptimized src={avatar} alt="头像" width={80} height={80} className="mx-auto size-20 rounded-full object-cover" />
        ) : (
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-3xl">🌱</div>
        )}
        <h2 className="mt-4 text-xl font-bold">{data.profile.display_name}</h2>
        <p className="text-sm text-slate-500">@{data.profile.username}</p>
      </section>
      <Link href="/settings" className="mt-4 block rounded-2xl bg-white p-4 font-semibold">个人设置</Link>
      <Link href="/weight" className="mt-3 block rounded-2xl bg-white p-4 font-semibold">体重与 BMI</Link>
      <Link href="/photos" className="mt-3 block rounded-2xl bg-white p-4 font-semibold">我的变化照片</Link>
      <Link href="/notifications" className="mt-3 block rounded-2xl bg-white p-4 font-semibold">通知中心</Link>
      <ActionStateForm action={logoutAction} className="mt-4">
        <PendingSubmitButton pendingLabel="退出中…" className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-semibold text-slate-600 disabled:opacity-50">退出登录</PendingSubmitButton>
      </ActionStateForm>
    </main>
  );
}

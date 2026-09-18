import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-emerald-50 px-6 text-slate-900">
      <section className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-xl shadow-emerald-900/10">
        <div className="text-5xl" aria-hidden="true">🌿</div>
        <h1 className="mt-4 text-2xl font-bold">当前处于离线状态</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          运动计划和打卡需要联网同步。恢复网络后，请重新打开页面。
        </p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 font-bold text-white">
          重试
        </Link>
      </section>
    </main>
  );
}

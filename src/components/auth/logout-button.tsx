"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { clearSessionAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/cloudbase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return <button type="button" disabled={pending} onClick={async () => {
    setPending(true);
    await createClient().auth.signOut();
    await clearSessionAction();
    router.replace("/login");
    router.refresh();
  }} className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 font-semibold text-slate-600 disabled:opacity-50">
    {pending ? "退出中…" : "退出登录"}
  </button>;
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getVerifiedUserId } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) redirect("/onboarding");
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><div className="mx-auto min-h-dvh max-w-lg bg-slate-50 px-5 pb-24 pt-6">{children}</div><BottomNav /></div>;
}

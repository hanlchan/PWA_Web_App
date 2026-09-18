"use client";

import { CalendarDays, ChartNoAxesColumn, Dumbbell, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "首页", Icon: House }, { href: "/plans", label: "计划", Icon: CalendarDays },
  { href: "/feed", label: "动态", Icon: Dumbbell }, { href: "/stats", label: "记录", Icon: ChartNoAxesColumn },
  { href: "/me", label: "我的", Icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return <nav aria-label="主导航" className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-lg border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
    {items.map(({ href, label, Icon }) => <Link key={href} href={href} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${pathname === href || (href !== "/" && pathname.startsWith(href)) ? "text-emerald-600" : "text-slate-500"}`}><Icon size={20}/>{label}</Link>)}
  </nav>;
}

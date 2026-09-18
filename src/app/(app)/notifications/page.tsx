import { markNotificationsReadAction } from "@/lib/actions/social";
import { getNotifications } from "@/lib/queries/social";

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  return <main><div className="flex items-center justify-between"><h1 className="text-2xl font-bold">通知</h1>{notifications.some(item => !item.read_at) && <form action={markNotificationsReadAction}><button className="min-h-11 px-3 text-sm font-semibold text-emerald-600">全部已读</button></form>}</div><section className="mt-6 space-y-2">{notifications.length === 0 ? <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">暂无通知</p> : notifications.map(item => <article key={item.id} className={`rounded-2xl p-4 ${item.read_at ? "bg-white" : "bg-emerald-50"}`}><p className="font-medium">{item.type === "nudge" ? `${item.actor_display_name ?? item.actor_username ?? "好友"} 催你去运动了 🔥` : item.type === "like" ? `${item.actor_display_name ?? item.actor_username ?? "好友"} 点赞了你的打卡 ❤️` : "今天还有运动计划 🔥"}</p><time className="mt-1 block text-xs text-slate-400">{new Date(item.created_at).toLocaleString("zh-CN")}</time></article>)}</section></main>;
}

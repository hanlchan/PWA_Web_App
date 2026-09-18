"use client";
import { useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/push";

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function applicationKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushSettings() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  const enable = () => startTransition(async () => {
    try {
      if (!supported) throw new Error("当前浏览器不支持系统通知，其他功能仍可正常使用");
      if (ios && !standalone) throw new Error("请先将网站添加到主屏幕，再开启通知");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("未获得通知权限，计划和打卡仍可正常使用");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const response = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!response.ok) throw new Error("推送服务尚未配置");
      const { publicKey } = await response.json() as { publicKey: string };
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
      const p256dh = subscription.getKey("p256dh"); const auth = subscription.getKey("auth");
      if (!p256dh || !auth) throw new Error("浏览器未返回完整订阅信息");
      const result = await savePushSubscriptionAction({ endpoint: subscription.endpoint, p256dh: toBase64Url(p256dh), auth: toBase64Url(auth), userAgent: navigator.userAgent });
      if (!result.ok) throw new Error(result.message);
      setMessage("运动提醒已开启");
    } catch (error) { setMessage(error instanceof Error ? error.message : "开启提醒失败"); }
  });

  const disable = () => startTransition(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const result = await removePushSubscriptionAction(subscription.endpoint);
        if (!result.ok) throw new Error(result.message);
        await subscription.unsubscribe();
      }
      setMessage("运动提醒已关闭");
    } catch (error) { setMessage(error instanceof Error ? error.message : "关闭提醒失败"); }
  });

  return <section className="mt-6 rounded-2xl bg-white p-4"><h2 className="font-bold">系统运动提醒</h2><p className="mt-1 text-xs leading-5 text-slate-500">只有点击下方按钮后才会申请通知权限。拒绝或不支持通知不会影响计划与打卡。</p>{ios && !standalone && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">iPhone/iPad：请先将网站添加到主屏幕，再开启通知。</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={enable} disabled={pending} className="min-h-11 flex-1 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white disabled:opacity-50">开启运动提醒</button><button type="button" onClick={disable} disabled={pending || !supported} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50">关闭</button></div>{message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}</section>;
}

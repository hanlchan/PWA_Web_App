import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { authorizeCron, getSupabaseSecretKey, requiredEnv } from "../_shared/cron.ts";

type Reminder = { occurrence_id: string; user_id: string; title: string; scheduled_time: string | null };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    const supabase = createClient(requiredEnv("SUPABASE_URL"), getSupabaseSecretKey(), { auth: { persistSession: false } });
    webpush.setVapidDetails(requiredEnv("VAPID_SUBJECT"), requiredEnv("VAPID_PUBLIC_KEY"), requiredEnv("VAPID_PRIVATE_KEY"));
    const { data, error } = await supabase.rpc("claim_due_reminders", { p_limit: 100 });
    if (error) throw error;
    let sent = 0;
    for (const reminder of (data ?? []) as Reminder[]) {
      const { data: subscriptions, error: subscriptionError } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", reminder.user_id);
      if (subscriptionError) throw subscriptionError;
      const payload = JSON.stringify({ title: "今天还有运动计划 🔥", body: reminder.title, url: "/", tag: `workout-${reminder.occurrence_id}` });
      for (const subscription of (subscriptions ?? []) as Subscription[]) {
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
          sent += 1;
        } catch (pushError) {
          const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          else console.error("push delivery failed", reminder.occurrence_id, statusCode);
        }
      }
      const { error: notificationError } = await supabase.from("notifications").insert({ user_id: reminder.user_id, type: "workout_reminder", data: { occurrence_id: reminder.occurrence_id, title: reminder.title } });
      if (notificationError?.code !== "23505") { if (notificationError) throw notificationError; }
    }
    return Response.json({ ok: true, claimed: (data ?? []).length, sent });
  } catch (error) {
    console.error("send-workout-reminders failed", error);
    return Response.json({ ok: false, error: "reminder delivery failed" }, { status: 500 });
  }
});

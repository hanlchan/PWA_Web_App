const webpush = require("web-push");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function gatewayOrigin() {
  return `https://${requiredEnv("CLOUDBASE_ENV_ID")}.api.tcloudbasegateway.com`;
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${gatewayOrigin()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requiredEnv("CLOUDBASE_APIKEY")}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`CloudBase data request failed with status ${response.status}`);
  return payload;
}

async function rpc(name, args = {}) {
  return request(`/v1/rdb/rest/rpc/${name}`, { method: "POST", body: args });
}

exports.main = async () => {
  try {
    webpush.setVapidDetails(requiredEnv("VAPID_SUBJECT"), requiredEnv("VAPID_PUBLIC_KEY"), requiredEnv("VAPID_PRIVATE_KEY"));
    const reminders = await rpc("claim_due_reminders", { p_limit: 100 }) ?? [];
    let sent = 0;

    for (const reminder of reminders) {
      const subscriptions = await request(`/v1/rdb/rest/push_subscriptions?select=id,endpoint,p256dh,auth&user_id=eq.${encodeURIComponent(reminder.user_id)}`) ?? [];
      const payload = JSON.stringify({
        title: "今天还有运动计划 🔥",
        body: reminder.title,
        url: "/",
        tag: `workout-${reminder.occurrence_id}`,
      });

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, payload);
          sent += 1;
        } catch (pushError) {
          const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError
            ? Number(pushError.statusCode)
            : 0;
          if (statusCode === 404 || statusCode === 410) {
            await request(`/v1/rdb/rest/push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, { method: "DELETE" });
          } else {
            console.error("push delivery failed", reminder.occurrence_id, statusCode);
          }
        }
      }

      try {
        await request("/v1/rdb/rest/notifications", {
          method: "POST",
          body: {
            user_id: reminder.user_id,
            type: "workout_reminder",
            data: { occurrence_id: reminder.occurrence_id, title: reminder.title },
          },
        });
      } catch (notificationError) {
        if (!(notificationError instanceof Error) || !notificationError.message.includes("409")) throw notificationError;
      }
    }

    return { ok: true, claimed: reminders.length, sent };
  } catch (error) {
    console.error("send-workout-reminders failed", error instanceof Error ? error.message : "unknown error");
    throw error;
  }
};

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Live test requires Supabase URL, publishable key, and a process-only secret key.");
}

const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceRoleKey, options);
const anon = createClient(url, publishableKey, options);
const userIds = [];
let photoOwner;
let photoPath;

function pass(message) {
  console.log(`PASS ${message}`);
}

function isoDateIn(timeZone, offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

async function expectOk(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function createTestUser(label, runId) {
  const email = `codex-e2e-${label}-${runId}@example.invalid`;
  const password = `E2e-${runId}-Aa9!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`create ${label}: ${created.error?.message ?? "missing user"}`);
  userIds.push(created.data.user.id);
  const client = createClient(url, publishableKey, options);
  await expectOk(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  await expectOk(await client.rpc("complete_onboarding", {
    p_username: `e2e_${label}_${runId}`,
    p_display_name: `E2E ${label.toUpperCase()}`,
    p_height_cm: 170,
    p_timezone: "Asia/Shanghai",
    p_avatar_path: null,
  }), `onboard ${label}`);
  return { client, id: created.data.user.id, username: `e2e_${label}_${runId}` };
}

async function createPlan(client, payload) {
  return expectOk(await client.rpc("create_workout_plan", { p_payload: payload }), `create ${payload.recurrenceType} plan`);
}

const runId = `${Date.now()}`.slice(-10);

try {
  const a = await createTestUser("a", runId);
  const b = await createTestUser("b", runId);
  pass("temporary users can authenticate and complete onboarding");

  const emptyPlans = await expectOk(await a.client.from("workout_plans").select("id"), "read initial plans");
  assert.equal(emptyPlans.length, 0);
  pass("onboarding creates no default workout plan");

  const today = isoDateIn("Asia/Shanghai");
  const tomorrow = isoDateIn("Asia/Shanghai", 1);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay() || 7;
  const monthDay = Number(today.slice(-2));
  const base = { description: "", durationMinutes: 20, startDate: today, endDate: null, startTime: null, reminderEnabled: true, notes: "" };
  const planIds = [
    await createPlan(a.client, { ...base, title: "E2E 单次", recurrenceType: "one_time" }),
    await createPlan(a.client, { ...base, title: "E2E 每周", recurrenceType: "weekly", daysOfWeek: [weekday] }),
    await createPlan(a.client, { ...base, title: "E2E 每月", recurrenceType: "monthly", daysOfMonth: [monthDay] }),
    await createPlan(a.client, { ...base, title: "E2E 自定义", recurrenceType: "custom_dates", customDates: [tomorrow] }),
  ];
  const aOccurrences = await expectOk(await a.client.from("plan_occurrences").select("id,plan_id,scheduled_date,status").in("plan_id", planIds), "read generated occurrences");
  for (const planId of planIds) assert.ok(aOccurrences.some((item) => item.plan_id === planId));
  pass("all four recurrence types generate occurrences");

  const futureOccurrence = aOccurrences.find((item) => item.scheduled_date === tomorrow);
  assert.ok(futureOccurrence);
  const futureCompletion = await a.client.rpc("complete_occurrence", { p_occurrence_id: futureOccurrence.id });
  assert.equal(futureCompletion.error?.code, "22023");
  pass("future occurrences cannot be completed through the RPC");

  const todayOccurrences = aOccurrences.filter((item) => item.scheduled_date === today).slice(0, 2);
  assert.equal(todayOccurrences.length, 2);
  const aCheckinIds = [];
  for (const occurrence of todayOccurrences) {
    aCheckinIds.push(await expectOk(await a.client.rpc("complete_occurrence", { p_occurrence_id: occurrence.id }), "complete A occurrence"));
  }
  await expectOk(await a.client.rpc("update_checkin_details", {
    p_checkin_id: aCheckinIds[0], p_duration_minutes: 25, p_activity_text: "快走", p_notes: "E2E detail",
  }), "update check-in details");
  const aDashboard = await expectOk(await a.client.rpc("get_today_dashboard"), "read A dashboard");
  assert.equal(aDashboard.total_checkin_days, 1);
  assert.equal(aDashboard.today_checkins.length, 2);
  pass("multiple check-ins count as one day and optional details can be saved");

  const bCompletedPlan = await createPlan(b.client, { ...base, title: "B 已完成", recurrenceType: "one_time" });
  await createPlan(b.client, { ...base, title: "B 待完成", recurrenceType: "weekly", daysOfWeek: [weekday] });
  const bOccurrences = await expectOk(await b.client.from("plan_occurrences").select("id,plan_id").eq("scheduled_date", today), "read B occurrences");
  const bCompletedOccurrence = bOccurrences.find((item) => item.plan_id === bCompletedPlan);
  assert.ok(bCompletedOccurrence);
  const bCheckinId = await expectOk(await b.client.rpc("complete_occurrence", { p_occurrence_id: bCompletedOccurrence.id }), "complete B occurrence");

  const hiddenProfile = await expectOk(await a.client.from("profiles").select("id").eq("id", b.id), "cross-user profile query");
  const hiddenSettings = await expectOk(await a.client.from("profile_settings").select("user_id").eq("user_id", b.id), "cross-user settings query");
  assert.equal(hiddenProfile.length, 0);
  assert.equal(hiddenSettings.length, 0);
  const publicProfile = await expectOk(await anon.rpc("get_public_user_profile", { p_username: b.username, p_month: `${today.slice(0, 7)}-01` }), "public profile RPC");
  assert.ok(publicProfile.checkin_dates.includes(today));
  assert.equal("email" in publicProfile, false);
  pass("private profile rows are isolated while safe public check-in dates remain visible");

  await expectOk(await a.client.rpc("create_weight_entry", { p_weight_kg: 72.5, p_measured_at: `${isoDateIn("Asia/Shanghai", -1)}T08:00:00`, p_measurement_type: "morning" }), "create first weight");
  await expectOk(await a.client.rpc("create_weight_entry", { p_weight_kg: 71.8, p_measured_at: `${today}T08:00:00`, p_measurement_type: "morning" }), "create second weight");
  const hiddenWeights = await expectOk(await b.client.from("weight_entries").select("weight_kg").eq("user_id", a.id), "cross-user weight query");
  assert.equal(hiddenWeights.length, 0);
  await expectOk(await a.client.from("profile_settings").update({ public_weight_trend: true }).eq("user_id", a.id), "enable public weight trend");
  const publicTrend = await expectOk(await anon.rpc("get_public_weight_trend", { p_username: a.username }), "public weight trend");
  assert.equal(publicTrend.length, 2);
  assert.ok(publicTrend.every((point) => "normalized_index" in point && !("weight_kg" in point)));
  pass("real weight is private and the public RPC returns normalized values only");

  assert.equal(await expectOk(await a.client.rpc("toggle_follow", { p_target_id: b.id }), "follow B"), true);
  const feed = await expectOk(await a.client.rpc("get_following_feed", { p_limit: 30 }), "following feed");
  assert.ok(feed.some((item) => item.user_id === b.id && item.checkin_id === bCheckinId));
  assert.equal(await expectOk(await a.client.rpc("toggle_checkin_like", { p_checkin_id: bCheckinId }), "like B check-in"), true);
  await expectOk(await a.client.rpc("send_nudge", { p_target_id: b.id }), "nudge B");
  const notifications = await expectOk(await b.client.rpc("get_my_notifications", { p_limit: 30 }), "read B notifications");
  assert.ok(notifications.some((item) => item.type === "like"));
  assert.ok(notifications.some((item) => item.type === "nudge"));
  pass("follow feed, like, nudge, and in-app notifications work end to end");

  photoOwner = a.client;
  photoPath = `${a.id}/${crypto.randomUUID()}.png`;
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  await expectOk(await a.client.storage.from("progress-photos").upload(photoPath, png, { contentType: "image/png", upsert: false }), "upload private photo");
  await expectOk(await a.client.from("progress_photos").insert({ user_id: a.id, storage_path: photoPath, photo_date: today, note: "E2E", visibility: "private" }), "save private photo metadata");
  const bPhotoRows = await expectOk(await b.client.from("progress_photos").select("id").eq("storage_path", photoPath), "B private photo query");
  assert.equal(bPhotoRows.length, 0);
  const bPrivateUrl = await b.client.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(bPrivateUrl.error);
  const ownerUrl = await a.client.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(ownerUrl.data?.signedUrl);
  await expectOk(await a.client.from("progress_photos").update({ visibility: "public" }).eq("storage_path", photoPath), "publish photo");
  const publicPhotos = await expectOk(await anon.rpc("get_public_progress_photos", { p_username: a.username }), "public photo RPC");
  assert.ok(publicPhotos.some((photo) => photo.storage_path === photoPath));
  const publicUrl = await anon.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(publicUrl.data?.signedUrl);
  pass("private photo isolation and explicit public signed URL flow work");

  console.log("All live Supabase checks passed.");
} finally {
  if (photoOwner && photoPath) await photoOwner.storage.from("progress-photos").remove([photoPath]);
  for (const id of userIds.reverse()) await admin.auth.admin.deleteUser(id);
  if (userIds.length > 0) console.log("CLEAN temporary users and related data removed");
}

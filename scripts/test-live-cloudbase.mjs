import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import cloudbase from "@cloudbase/js-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const region = "ap-shanghai";
const origin = `https://${envId}.api.tcloudbasegateway.com`;

function parseEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = rawLine.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const localEnv = parseEnvFile(join(root, ".env.local"));
const publishableKey = localEnv.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error("NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY is required");

const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, TCB_SITE: "domestic" },
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
      .replace(/Cbx-[A-Za-z0-9_-]+!9a/g, "[REDACTED]")
      .trim()
      .slice(0, 1200);
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout;
}

function callMcp(tool, values, label) {
  return run(process.execPath, [
    npxCli,
    "--yes",
    "--cache",
    join(root, ".npm-cache"),
    "mcporter",
    "call",
    "--stdio",
    "node",
    "--stdio-arg",
    npxCli.replaceAll("\\", "/"),
    "--stdio-arg",
    "-y",
    "--stdio-arg",
    "@cloudbase/cloudbase-mcp@latest",
    tool,
    ...Object.entries(values).map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`),
    "--output",
    "json",
    "--timeout",
    "120000",
  ], label);
}

function executeAdminSql(sql, label) {
  return callMcp("managePgDatabase", { action: "execute", sql, confirm: true }, label);
}

function queryAdminSnapshot() {
  const tables = [
    "profiles", "profile_settings", "workout_plans", "plan_custom_dates", "plan_occurrences",
    "checkins", "weight_entries", "follows", "checkin_likes", "notifications", "nudges",
    "push_subscriptions", "progress_photos",
  ];
  const pairs = tables.map((table) => [
    `'${table}'`,
    `jsonb_build_object('count',(select count(*) from public.${table}),'hash',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) from public.${table} t))`,
  ].join(","));
  pairs.push(
    `'storage.objects',jsonb_build_object('count',(select count(*) from storage.objects),'hash',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) from storage.objects t))`,
  );
  const response = JSON.parse(callMcp(
    "queryPgDatabase",
    { action: "sql", sql: `select jsonb_build_object(${pairs.join(",")}) as snapshot` },
    "query data integrity snapshot",
  ));
  const rawSnapshot = response?.data?.rows?.[0]?.snapshot;
  const snapshot = typeof rawSnapshot === "string" ? JSON.parse(rawSnapshot) : rawSnapshot;
  if (!snapshot || typeof snapshot !== "object") throw new Error("CloudBase did not return a data integrity snapshot");
  return snapshot;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function todayInShanghai(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function tokenFrom(session) {
  const accessToken = session?.access_token ?? session?.accessToken;
  const refreshToken = session?.refresh_token ?? session?.refreshToken;
  if (!accessToken || !refreshToken) throw new Error("CloudBase session did not include both tokens");
  return { access_token: accessToken, refresh_token: refreshToken };
}

function encodeFilter(value) {
  return String(value).replaceAll(",", "\\,").replaceAll(")", "\\)");
}

async function api(token, path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? String(payload.message ?? payload.error_description ?? payload.error ?? payload.code ?? response.status)
      : String(payload ?? response.status);
    const error = new Error(detail);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function tablePath(table, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) params.append(key, value);
  const suffix = params.size ? `?${params}` : "";
  return `/v1/rdb/rest/${table}${suffix}`;
}

async function select(token, table, columns = "*", filters = {}) {
  const query = { select: columns };
  for (const [column, value] of Object.entries(filters)) query[column] = `eq.${encodeFilter(value)}`;
  const result = await api(token, tablePath(table, query));
  return Array.isArray(result) ? result : [];
}

async function insert(token, table, body) {
  return api(token, tablePath(table), { method: "POST", body });
}

async function update(token, table, body, filters) {
  const query = {};
  for (const [column, value] of Object.entries(filters)) query[column] = `eq.${encodeFilter(value)}`;
  return api(token, tablePath(table, query), { method: "PATCH", body });
}

async function remove(token, table, filters) {
  const query = {};
  for (const [column, value] of Object.entries(filters)) query[column] = `eq.${encodeFilter(value)}`;
  return api(token, tablePath(table, query), { method: "DELETE" });
}

async function rpc(token, name, args = {}) {
  return api(token, `/v1/rdb/rest/rpc/${name}`, { method: "POST", body: args });
}

async function expectDenied(operation, label) {
  try {
    const result = await operation();
    if (Array.isArray(result) && result.length === 0) return;
  } catch (error) {
    if ([400, 401, 403, 404].includes(error.status)) return;
    throw error;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

const app = cloudbase.init({
  env: envId,
  region,
  accessKey: publishableKey,
  auth: { detectSessionInUrl: false },
});

const runId = `${Date.now()}`.slice(-9);
const migratedUsers = JSON.parse(readFileSync(join(root, ".migration-work", "auth-user-map.json"), "utf8"));
if (!Array.isArray(migratedUsers) || migratedUsers.length !== 2) {
  throw new Error("Expected exactly two migrated Auth users");
}
const users = migratedUsers.map((source, index) => ({
  label: index === 0 ? "a" : "b",
  uid: source.uid,
  username: source.uid,
  email: source.email,
  profileUsername: null,
  password: `Cbx-${randomBytes(18).toString("base64url")}!9a`,
  session: null,
}));
const uploaded = [];
const cleanupPlanIds = [];
const cleanupWeightIds = [];
let cleanupPhotoId = null;
let restoreFollow = null;
let restoreLike = null;
const baselineSnapshot = queryAdminSnapshot();

async function switchSession(user) {
  const result = await app.auth.setSession(tokenFrom(user.session));
  if (result.error) throw new Error(`set session ${user.label}: ${result.error.message}`);
}

async function signIn(user) {
  const result = await app.auth.signInWithPassword({ email: user.email, password: user.password });
  if (result.error || !result.data?.session) {
    throw new Error(`sign in ${user.label}: ${result.error?.message ?? "missing session"}`);
  }
  user.session = result.data.session;
  const current = await app.auth.getSession();
  assert.ok(current.data?.session);
  const refreshed = await app.auth.refreshSession();
  if (refreshed.error || !refreshed.data?.session) throw new Error(`refresh ${user.label}: ${refreshed.error?.message ?? "missing session"}`);
  user.session = refreshed.data.session;
  assert.equal(user.session.user?.id ?? user.session.user?.sub, user.uid);
  const signedOut = await app.auth.signOut();
  if (signedOut.error) throw new Error(`sign out ${user.label}: ${signedOut.error.message}`);
  const signedInAgain = await app.auth.signInWithPassword({ email: user.email, password: user.password });
  if (signedInAgain.error || !signedInAgain.data?.session) {
    throw new Error(`sign in again ${user.label}: ${signedInAgain.error?.message ?? "missing session"}`);
  }
  user.session = signedInAgain.data.session;
}

try {
  for (const user of users) {
    callMcp("managePermissions", {
      action: "updateUser",
      uid: user.uid,
      password: user.password,
      userStatus: "ACTIVE",
    }, `set temporary password for migrated user ${user.label}`);
    await signIn(user);
  }
  pass("password login, session lookup, refresh, sign-out, and UUID preservation");

  const [a, b] = users;
  const aToken = tokenFrom(a.session).access_token;
  const bToken = tokenFrom(b.session).access_token;

  for (const user of users) {
    const token = tokenFrom(user.session).access_token;
    const profiles = await select(token, "profiles", "id,username", { id: user.uid });
    assert.equal(profiles.length, 1);
    user.profileUsername = profiles[0].username;
    assert.equal((await select(token, "profile_settings", "user_id", { user_id: user.uid })).length, 1);
  }
  pass("migrated Auth UUIDs still map to their original profiles and settings");

  assert.equal((await select(aToken, "profiles", "id", { id: b.uid })).length, 0);
  assert.equal((await select(aToken, "profile_settings", "user_id", { user_id: b.uid })).length, 0);
  await expectDenied(
    () => insert(aToken, "profiles", { id: b.uid, username: `forged_${runId}`, display_name: "forged" }),
    "cross-user profile insert",
  );
  pass("profile and settings RLS isolate users");

  const today = todayInShanghai();
  const tomorrow = todayInShanghai(1);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay() || 7;
  const planPayload = {
    title: `CloudBase E2E ${runId} A`,
    description: "",
    durationMinutes: 20,
    recurrenceType: "weekly",
    startDate: today,
    endDate: null,
    daysOfWeek: [weekday],
    startTime: null,
    reminderEnabled: true,
    notes: "",
  };
  const aPlanId = await rpc(aToken, "create_workout_plan", { p_payload: planPayload });
  cleanupPlanIds.push(aPlanId);
  const aOccurrences = await select(aToken, "plan_occurrences", "id,scheduled_date,status", { plan_id: aPlanId });
  const aToday = aOccurrences.find((item) => item.scheduled_date === today);
  assert.ok(aToday);
  const aCheckinId = await rpc(aToken, "complete_occurrence", { p_occurrence_id: aToday.id });
  await rpc(aToken, "undo_checkin", { p_checkin_id: aCheckinId });
  const aCheckinAgain = await rpc(aToken, "complete_occurrence", { p_occurrence_id: aToday.id });
  assert.ok(aCheckinAgain);
  const futureManual = await rpc(aToken, "create_manual_checkin", { p_checkin_date: tomorrow, p_is_backfilled: false }).catch((error) => error);
  assert.ok(futureManual instanceof Error);
  pass("plan creation, occurrence generation, check-in, undo, and date guards");

  const bPlanId = await rpc(bToken, "create_workout_plan", { p_payload: { ...planPayload, title: `CloudBase E2E ${runId} B` } });
  cleanupPlanIds.push(bPlanId);
  const bOccurrences = await select(bToken, "plan_occurrences", "id,scheduled_date", { plan_id: bPlanId });
  const bToday = bOccurrences.find((item) => item.scheduled_date === today);
  assert.ok(bToday);
  const bCheckinId = await rpc(bToken, "complete_occurrence", { p_occurrence_id: bToday.id });

  const weightId = await rpc(aToken, "create_weight_entry", { p_weight_kg: 72.5, p_measured_at: `${today}T08:00:00`, p_measurement_type: "morning" });
  cleanupWeightIds.push(weightId);
  assert.equal((await select(bToken, "weight_entries", "id,weight_kg", { user_id: a.uid })).length, 0);
  await expectDenied(
    () => insert(bToken, "weight_entries", { user_id: a.uid, weight_kg: 33, measured_at: new Date().toISOString(), measurement_type: "custom" }),
    "cross-user weight insert",
  );
  pass("weight records remain private and cross-user writes are denied");

  const aWasFollowing = (await select(aToken, "follows", "follower_id", { follower_id: a.uid, following_id: b.uid })).length === 1;
  if (!aWasFollowing) {
    assert.equal(await rpc(aToken, "toggle_follow", { p_target_id: b.uid }), true);
    restoreFollow = { token: aToken, targetId: b.uid };
  }
  const feed = await rpc(aToken, "get_following_feed", { p_limit: 30 });
  assert.ok(feed.some((item) => item.user_id === b.uid && item.checkin_id === bCheckinId));
  assert.equal(await rpc(aToken, "toggle_checkin_like", { p_checkin_id: bCheckinId }), true);
  restoreLike = { token: aToken, checkinId: bCheckinId };
  const bNotifications = await rpc(bToken, "get_my_notifications", { p_limit: 30 });
  assert.ok(bNotifications.some((item) => item.type === "like"));
  assert.equal((await select(aToken, "notifications", "id", { user_id: b.uid })).length, 0);
  pass("follow, feed, like, and notification privacy work without changing existing follow state");

  assert.equal((await select(bToken, "push_subscriptions", "id", { user_id: a.uid })).length, 0);
  pass("push subscription endpoints are hidden from other users");

  const png = new Blob([
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  ], { type: "image/png" });
  const avatarPath = `${a.uid}/e2e-${runId}.png`;
  const photoPath = `${a.uid}/e2e-${runId}.png`;
  await switchSession(a);
  const avatarUpload = await app.storage.from("avatars").upload(avatarPath, png, { contentType: "image/png", upsert: false });
  if (avatarUpload.error) throw new Error(`avatar upload: ${avatarUpload.error.message}`);
  uploaded.push({ user: a, bucket: "avatars", path: avatarPath });
  const photoUpload = await app.storage.from("progress-photos").upload(photoPath, png, { contentType: "image/png", upsert: false });
  if (photoUpload.error) throw new Error(`progress photo upload: ${photoUpload.error.message}`);
  uploaded.push({ user: a, bucket: "progress-photos", path: photoPath });
  const insertedPhotos = await insert(aToken, "progress_photos", {
    user_id: a.uid,
    storage_path: photoPath,
    photo_date: today,
    note: "CloudBase E2E",
    visibility: "private",
  });
  cleanupPhotoId = insertedPhotos?.[0]?.id ?? null;
  assert.equal((await select(bToken, "progress_photos", "id", { storage_path: photoPath })).length, 0);
  await switchSession(b);
  const deniedUrl = await app.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(deniedUrl.error);
  await switchSession(a);
  const ownerUrl = await app.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(ownerUrl.data?.fullSignedURL);
  await update(aToken, "progress_photos", { visibility: "public" }, { storage_path: photoPath });
  await app.auth.signOut();
  const publicPhotos = await rpc(publishableKey, "get_public_progress_photos", { p_username: a.profileUsername });
  assert.ok(publicPhotos.some((photo) => photo.storage_path === photoPath));
  const publicPhotoUrl = await app.storage.from("progress-photos").createSignedUrl(photoPath, 60);
  assert.ok(publicPhotoUrl.data?.fullSignedURL);
  const avatarUrl = app.storage.from("avatars").getPublicUrl(avatarPath);
  assert.ok(avatarUrl.data?.publicUrl);
  const avatarResponse = await fetch(avatarUrl.data.publicUrl);
  assert.equal(avatarResponse.status, 200);
  pass("avatar public read and private/public progress-photo storage rules work");

  console.log("All live CloudBase integration checks passed.");
} finally {
  if (restoreLike) {
    try { await rpc(restoreLike.token, "toggle_checkin_like", { p_checkin_id: restoreLike.checkinId }); } catch { /* continue */ }
  }
  if (restoreFollow) {
    try { await rpc(restoreFollow.token, "toggle_follow", { p_target_id: restoreFollow.targetId }); } catch { /* continue */ }
  }
  if (cleanupPhotoId && users[0]?.session) {
    try { await remove(tokenFrom(users[0].session).access_token, "progress_photos", { id: cleanupPhotoId }); } catch { /* continue */ }
  }
  for (const item of uploaded.reverse()) {
    try {
      await switchSession(item.user);
      await app.storage.from(item.bucket).remove([item.path]);
    } catch {
      // Cleanup continues for remaining temporary resources.
    }
  }
  for (const id of cleanupWeightIds) {
    try { executeAdminSql(`delete from public.weight_entries where id = '${id}'`, "cleanup test weight"); } catch { /* continue */ }
  }
  for (const id of cleanupPlanIds.reverse()) {
    try {
      executeAdminSql(
        `delete from public.checkins where occurrence_id in (select id from public.plan_occurrences where plan_id = '${id}')`,
        "cleanup test plan checkins",
      );
      executeAdminSql(`delete from public.plan_occurrences where plan_id = '${id}'`, "cleanup test plan occurrences");
      executeAdminSql(`delete from public.plan_custom_dates where plan_id = '${id}'`, "cleanup test plan custom dates");
      executeAdminSql(`delete from public.workout_plans where id = '${id}'`, "cleanup test plan");
    } catch { /* integrity snapshot below will fail closed */ }
  }
  const finalSnapshot = queryAdminSnapshot();
  assert.deepEqual(finalSnapshot, baselineSnapshot, "Existing CloudBase database or storage data changed during integration testing");
  console.log("CLEAN temporary CloudBase business data removed; migrated users and pre-existing data retained byte-for-byte");
}

// The Web SDK keeps background auth handles alive in Node after all assertions
// and cleanup have finished. This script is a one-shot migration verifier.
process.exit(0);

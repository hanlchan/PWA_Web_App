import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const origin = `https://${envId}-1493086646.tcloudbaseapp.com`;
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const tcb = [npxCli, "--yes", "--cache", join(root, ".npm-cache"), "--package", "@cloudbase/cli", "tcb"];
const cleanupUid = process.argv.find((arg) => arg.startsWith("--cleanup-uid="))?.slice("--cleanup-uid=".length);
if (cleanupUid) assert.match(cleanupUid, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
const crossUser = process.argv.includes("--cross-user");
const refreshOnly = process.argv.includes("--refresh-only");
assert.ok(!(crossUser && refreshOnly), "Choose one disposable-account test mode");
assert.ok(!cleanupUid || (!crossUser && !refreshOnly), "Recovery mode cannot run a browser test");
function disposableUser(knownUid) {
  const suffix = randomBytes(6).toString("hex");
  return {
    uid: knownUid ?? randomUUID(),
    username: `e2e_${suffix}`,
    email: `cloudbase-e2e-${suffix}@example.com`,
    password: `Cbx-${randomBytes(12).toString("base64url")}!9a`,
  };
}
const primary = disposableUser(cleanupUid);
const users = crossUser ? [primary, disposableUser()] : [primary];
const { uid, username, email, password } = primary;
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const tables = [
  "profiles", "profile_settings", "workout_plans", "plan_custom_dates", "plan_occurrences",
  "checkins", "weight_entries", "follows", "checkin_likes", "notifications", "nudges",
  "push_subscriptions", "progress_photos",
];

function run(args, label, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 240_000,
  });
  if (result.error || result.status !== 0) {
    let detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    for (const user of users) detail = detail.replaceAll(user.password, "[REDACTED_TEST_PASSWORD]").replaceAll(user.email, "[REDACTED_TEST_EMAIL]");
    detail = detail.slice(-5000);
    throw new Error(`${label} failed (${result.status ?? result.error?.code ?? "unknown"}): ${detail}`);
  }
  return result.stdout;
}

function cli(args, label) {
  return JSON.parse(run([...tcb, ...args, "--json"], label));
}

function sql(statement, label) {
  return cli(["db", "execute", "--env-id", envId, "--sql", statement], label);
}

function snapshot() {
  const pairs = tables.flatMap((table) => [
    `'${table}'`,
    `jsonb_build_object('count',(select count(*) from public.${table}),'hash',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) from public.${table} t))`,
  ]);
  pairs.push(
    "'storage.objects'",
    "jsonb_build_object('count',(select count(*) from storage.objects),'hash',(select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) from storage.objects t))",
  );
  const response = sql(`select jsonb_build_object(${pairs.join(",")}) as snapshot`, "business-data snapshot");
  const row = JSON.parse(response.data?.Rows?.[0] ?? "[]");
  const value = typeof row[0] === "string" ? JSON.parse(row[0]) : row[0];
  if (!value || typeof value !== "object") throw new Error("CloudBase snapshot is incomplete");
  return value;
}

function userExists(testUser = primary) {
  const response = cli(["user", "list", "--env-id", envId, "--uids", testUser.uid, "--limit", "20"], "test-user lookup");
  return (response.data ?? []).some((user) => (user.uid ?? user.Uid ?? user.id) === testUser.uid);
}

function assertDisposableUser(testUser = primary) {
  const response = cli(["user", "list", "--env-id", envId, "--uids", testUser.uid], "disposable-user identity check");
  const user = (response.data ?? []).find((item) => (item.uid ?? item.Uid) === testUser.uid);
  assert.ok(user, "Disposable user does not exist");
  assert.match(user.name ?? user.Name, /^e2e_[0-9a-f]{12}$/);
  if (!cleanupUid) assert.equal(user.name ?? user.Name, testUser.username);
  assert.equal(user.description ?? user.Description, "Disposable CloudBase browser E2E account");
  assert.equal(user.type ?? user.Type, "externalUser");
}

function assertNoUnownedReferences() {
  const owners = `ARRAY[${users.map((user) => `'${user.uid}'::uuid`).join(",")}]`;
  const query = `select jsonb_build_object(
    'external_follows',(select count(*) from public.follows where (following_id=any(${owners}) and follower_id<>all(${owners})) or (follower_id=any(${owners}) and following_id<>all(${owners}))),
    'external_nudges',(select count(*) from public.nudges where (target_id=any(${owners}) and actor_id<>all(${owners})) or (actor_id=any(${owners}) and target_id<>all(${owners}))),
    'external_likes',(select count(*) from public.checkin_likes where (user_id=any(${owners}) and checkin_id not in (select id from public.checkins where user_id=any(${owners}))) or (user_id<>all(${owners}) and checkin_id in (select id from public.checkins where user_id=any(${owners})))),
    'external_notifications',(select count(*) from public.notifications where (user_id=any(${owners}) and actor_id is not null and actor_id<>all(${owners})) or (actor_id=any(${owners}) and user_id<>all(${owners}))),
    'test_storage',(select count(*) from storage.objects where owner_id=any(${owners}::text[]))
  ) as refs`;
  const response = sql(query.replace(/\s+/g, " "), "test-user external-reference check");
  const row = JSON.parse(response.data?.Rows?.[0] ?? "[]");
  const refs = typeof row[0] === "string" ? JSON.parse(row[0]) : row[0];
  assert.ok(Object.values(refs).every((count) => Number(count) === 0), "Test account has non-test references or Storage objects; cleanup stopped");
}

function cleanupBusinessRows() {
  assertNoUnownedReferences();
  const owners = `ARRAY[${users.map((user) => `'${user.uid}'::uuid`).join(",")}]`;
  const statements = [
    `delete from public.notifications where user_id=any(${owners}) or actor_id=any(${owners})`,
    `delete from public.checkin_likes where user_id=any(${owners}) or checkin_id in (select id from public.checkins where user_id=any(${owners}))`,
    `delete from public.follows where follower_id=any(${owners}) or following_id=any(${owners})`,
    `delete from public.nudges where actor_id=any(${owners}) or target_id=any(${owners})`,
    `delete from public.push_subscriptions where user_id=any(${owners})`,
    `delete from public.progress_photos where user_id=any(${owners})`,
    `delete from public.weight_entries where user_id=any(${owners})`,
    `delete from public.checkins where user_id=any(${owners})`,
    `delete from public.plan_occurrences where user_id=any(${owners})`,
    `delete from public.plan_custom_dates where plan_id in (select id from public.workout_plans where user_id=any(${owners}))`,
    `delete from public.workout_plans where user_id=any(${owners})`,
    `delete from public.profile_settings where user_id=any(${owners})`,
    `delete from public.profiles where id=any(${owners})`,
  ];
  for (const [index, statement] of statements.entries()) {
    sql(statement, `cleanup test-only table ${index + 1}`);
  }
}

if (!process.argv.includes("--apply")) {
  if (cleanupUid) {
    assertDisposableUser();
    const baseline = snapshot();
    assertNoUnownedReferences();
    const profileResponse = sql(`select count(*) from public.profiles where id='${uid}'::uuid`, "recovery profile check");
    const profileCount = Number(JSON.parse(profileResponse.data?.Rows?.[0] ?? "[]")[0]);
    assert.equal(profileCount, 0, "Recovery account has a profile; Auth user retained for audit");
    cli(["user", "delete", uid, "--env-id", envId, "--yes"], "delete disposable test user");
    assert.equal(userExists(), false, "Disposable Auth user still exists after recovery cleanup");
    assert.deepEqual(snapshot(), baseline, "Business data changed during recovery cleanup");
    console.log(JSON.stringify({ stage: "recovered-and-cleaned", testUid: uid, existingDataUnchanged: true }));
    process.exit(0);
  }
  const before = snapshot();
  console.log(JSON.stringify({ mode: "dry-run", envId, tableCount: tables.length, baselineRows: Object.values(before).reduce((sum, item) => sum + Number(item.count), 0) }));
  process.exit(0);
}

const baseline = snapshot();
for (const user of users) assert.equal(userExists(user), false, "Generated test UID unexpectedly exists");
const created = new Set();
let testError = null;
try {
  for (const user of users) {
    cli([
      "user", "create", user.username, "--env-id", envId, "--uid", user.uid,
      "--email", user.email, "--password", user.password, "--type", "externalUser", "--status", "ACTIVE",
      "--description", "Disposable CloudBase browser E2E account",
    ], "create disposable test user");
    created.add(user.uid);
    assert.equal(userExists(user), true, "CloudBase did not list the created test UID");
    console.log(JSON.stringify({ stage: "created", testUid: user.uid }));
  }

  const browserOutput = run([
    join(root, "node_modules", "@playwright", "test", "cli.js"),
    "test", crossUser || refreshOnly ? "tests/e2e/live-cross-user.spec.ts" : "tests/e2e/live-flow.spec.ts",
    "--grep", crossUser ? "two disposable CloudBase users" : refreshOnly ? "fresh temporary account survives" : "onboards, creates a plan",
    "--project=desktop-chromium", "--reporter=line", "--workers=1",
  ], "disposable-account browser E2E", {
    LIVE_CLOUDBASE_E2E: "1",
    LIVE_CLOUDBASE_E2E_EMAIL: email,
    LIVE_CLOUDBASE_E2E_PASSWORD: password,
    LIVE_CLOUDBASE_E2E_UID: uid,
    LIVE_CLOUDBASE_E2E_USERNAME: username,
    LIVE_CLOUDBASE_E2E_OTHER_EMAIL: users[1]?.email ?? "",
    LIVE_CLOUDBASE_E2E_OTHER_PASSWORD: users[1]?.password ?? "",
    LIVE_CLOUDBASE_E2E_OTHER_UID: users[1]?.uid ?? "",
    LIVE_CLOUDBASE_E2E_OTHER_USERNAME: users[1]?.username ?? "",
    PLAYWRIGHT_BASE_URL: origin,
    PLAYWRIGHT_EXECUTABLE_PATH: chrome,
    PLAYWRIGHT_DISABLE_PROXY: "1",
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
  });
  assert.match(browserOutput, /1 passed/);
  console.log(JSON.stringify({ stage: "browser-verified", passed: 1 }));
} catch (error) {
  testError = error;
} finally {
  for (const user of users) {
    if (!created.has(user.uid)) {
      try {
        if (userExists(user)) created.add(user.uid);
      } catch (lookupError) {
        throw new AggregateError([testError, lookupError].filter(Boolean), `Could not establish disposable test-user creation state for UID ${user.uid}`);
      }
    }
  }
  if (created.size > 0) {
    try {
      for (const user of users.filter((item) => created.has(item.uid))) {
        assertDisposableUser(user);
        const storageCleanup = run([
          join(root, "scripts", "cleanup-cloudbase-disposable-storage.mjs"),
        ], "cleanup disposable Storage objects", {
          LIVE_CLOUDBASE_E2E_UID: user.uid,
          LIVE_CLOUDBASE_E2E_EMAIL: user.email,
          LIVE_CLOUDBASE_E2E_PASSWORD: user.password,
        });
        console.log(storageCleanup.trim());
      }
      cleanupBusinessRows();
      assert.deepEqual(snapshot(), baseline, "Target business data differs after test-only cleanup");
      for (const user of users.filter((item) => created.has(item.uid))) {
        cli(["user", "delete", user.uid, "--env-id", envId, "--yes"], "delete disposable test user");
        assert.equal(userExists(user), false, "Disposable Auth user still exists after deletion");
        console.log(JSON.stringify({ stage: "cleaned", testUid: user.uid, existingDataUnchanged: true }));
      }
    } catch (cleanupError) {
      throw new AggregateError([testError, cleanupError].filter(Boolean), `Disposable test cleanup needs investigation for UID ${uid}`);
    }
  }
}

if (testError) throw testError;
console.log(JSON.stringify({ mode: "verified", browserE2E: "passed", businessDataUnchanged: true, testAccountRemoved: true }));

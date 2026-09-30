import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cloudbase from "@cloudbase/js-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const uid = process.env.LIVE_CLOUDBASE_E2E_UID;
const email = process.env.LIVE_CLOUDBASE_E2E_EMAIL;
const password = process.env.LIVE_CLOUDBASE_E2E_PASSWORD;
assert.match(uid ?? "", /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
assert.ok(email && password, "Disposable-account credentials are required for Storage cleanup");

function cliSql(statement) {
  const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  const result = spawnSync(process.execPath, [
    npxCli, "--yes", "--cache", join(root, ".npm-cache"), "--package", "@cloudbase/cli",
    "tcb", "db", "execute", "--env-id", envId, "--sql", statement, "--json",
  ], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 90_000 });
  if (result.status !== 0) throw new Error(`Storage inventory failed: ${String(result.stderr || result.stdout).slice(-800)}`);
  return JSON.parse(result.stdout).data?.Rows ?? [];
}

const query = `select bucket_id,name,owner_id from storage.objects where bucket_id in ('avatars','progress-photos') and name like '${uid}/%' order by bucket_id,name`;
const objects = cliSql(query).map((row) => {
  const [bucket, name, owner] = JSON.parse(row);
  assert.ok(["avatars", "progress-photos"].includes(bucket));
  assert.ok(name.startsWith(`${uid}/`));
  assert.equal(owner, uid, "A test-path object is owned by another user; cleanup stopped");
  return { bucket, name };
});

if (objects.length === 0) {
  console.log(JSON.stringify({ testStorageObjectsRemoved: 0 }));
  process.exit(0);
}

const keyLine = readFileSync(join(root, ".env.local"), "utf8")
  .split(/\r?\n/).find((line) => line.startsWith("NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY="));
assert.ok(keyLine, "CloudBase publishable key is missing from local environment");
const accessKey = keyLine.slice("NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY=".length).trim().replace(/^['"]|['"]$/g, "");
const app = cloudbase.init({ env: envId, region: "ap-shanghai", accessKey, auth: { detectSessionInUrl: false } });

let failure = null;
try {
  const login = await app.auth.signInWithPassword({ email, password });
  if (login.error || !login.data?.session) throw new Error("Disposable test-user login failed during Storage cleanup");
  const sessionUid = login.data.session.user?.id ?? login.data.session.user?.sub;
  assert.equal(sessionUid, uid, "Storage cleanup authenticated as an unexpected user");
  for (const { bucket, name } of objects) {
    const removed = await app.storage.from(bucket).remove([name]);
    if (removed.error) throw new Error(`Could not remove disposable ${bucket} object: ${removed.error.message}`);
  }
  assert.equal(cliSql(query).length, 0, "Disposable Storage objects remain after removal");
  console.log(JSON.stringify({ testStorageObjectsRemoved: objects.length }));
} catch (error) {
  failure = error;
} finally {
  const signedOut = await app.auth.signOut();
  if (signedOut.error && !failure) failure = signedOut.error;
}
if (failure) {
  console.error(String(failure instanceof Error ? failure.message : failure).replaceAll(password, "[REDACTED]"));
  process.exit(1);
}
process.exit(0);

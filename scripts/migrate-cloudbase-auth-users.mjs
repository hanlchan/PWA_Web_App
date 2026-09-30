import { spawnSync } from "node:child_process";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envId = "pwa-web-app-d8gpuhess695771e6";
const sourceCli = path.join(
  root,
  "node_modules",
  "@supabase",
  "cli-windows-x64",
  "bin",
  "supabase.exe",
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, TCB_SITE: "domestic" },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${result.stderr || "unknown error"}`);
  }
  return result.stdout;
}

async function findCloudBaseCli() {
  const npxRoot = path.join(root, ".npm-cache", "_npx");
  const entries = await readdir(npxRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(
      npxRoot,
      entry.name,
      "node_modules",
      "@cloudbase",
      "cli",
      "bin",
      "tcb",
    );
    try {
      await import("node:fs/promises").then(({ access }) => access(candidate));
      return candidate;
    } catch {
      // Continue looking through the local npx cache.
    }
  }
  throw new Error("CloudBase CLI was not found in the project-local npx cache");
}

const sourceOutput = run(sourceCli, [
  "--output",
  "json",
  "db",
  "query",
  "--linked",
  "select id::text uid, email from auth.users where email is not null order by id",
]);
const source = JSON.parse(sourceOutput);
if (!Array.isArray(source.rows)) throw new Error("Supabase Auth export did not return rows");

const users = source.rows.map(({ uid, email }) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) {
    throw new Error("A source Auth UID is not a UUID");
  }
  if (typeof email !== "string" || !email.includes("@")) {
    throw new Error("A source Auth user has no valid email address");
  }
  return { uid, email };
});

const workDirectory = path.join(root, ".migration-work");
await mkdir(workDirectory, { recursive: true });
await writeFile(path.join(workDirectory, "auth-user-map.json"), `${JSON.stringify(users)}\n`, "utf8");

const tcbCli = await findCloudBaseCli();
const listUsers = () => {
  if (users.length === 0) return [];
  const output = run(process.execPath, [
    tcbCli,
    "user",
    "list",
    "-e",
    envId,
    "--uids",
    users.map(({ uid }) => uid).join(","),
    "--limit",
    String(Math.max(users.length, 20)),
    "--json",
  ]);
  const payload = JSON.parse(output);
  return Array.isArray(payload.data) ? payload.data : [];
};

const existing = new Set(
  listUsers().map((user) => user.uid ?? user.Uid ?? user.id ?? user.sub).filter(Boolean),
);
let created = 0;
for (const user of users) {
  if (existing.has(user.uid)) continue;
  const output = run(process.execPath, [
    tcbCli,
    "user",
    "create",
    user.uid,
    "-e",
    envId,
    "--uid",
    user.uid,
    "--email",
    user.email,
    "--type",
    "internalUser",
    "--status",
    "ACTIVE",
    "--description",
    "Migrated account; password reset required",
    "--json",
  ]);
  const payload = JSON.parse(output);
  const returnedUid = payload?.Data?.Uid ?? payload?.data?.uid ?? payload?.uid;
  if (returnedUid && returnedUid !== user.uid) {
    throw new Error("CloudBase created an Auth user with an unexpected UID");
  }
  created += 1;
}

const verified = new Set(
  listUsers().map((user) => user.uid ?? user.Uid ?? user.id ?? user.sub).filter(Boolean),
);
const missing = users.filter(({ uid }) => !verified.has(uid));
if (missing.length > 0) throw new Error(`${missing.length} Auth users were not found after import`);

console.log(JSON.stringify({ sourceUsers: users.length, created, verified: verified.size }));

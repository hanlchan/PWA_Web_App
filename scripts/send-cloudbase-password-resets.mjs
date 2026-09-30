import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cloudbase from "@cloudbase/js-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const env = parseEnvFile(join(root, ".env.local"));
const users = JSON.parse(readFileSync(join(root, ".migration-work", "auth-user-map.json"), "utf8"));
if (!Array.isArray(users) || users.length === 0 || users.some((user) => typeof user.email !== "string")) {
  throw new Error("Migrated Auth email mapping is incomplete");
}

const app = cloudbase.init({
  env: env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
  region: env.NEXT_PUBLIC_CLOUDBASE_REGION,
  accessKey: env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
  auth: { detectSessionInUrl: false },
});

let requested = 0;
for (const user of users) {
  const { data, error } = await app.auth.resetPasswordForEmail(user.email);
  if (error) throw new Error(`CloudBase password reset request failed: ${error.message}`);
  if (!data?.updateUser) throw new Error("CloudBase password reset did not return an update flow");
  requested += 1;
}

console.log(JSON.stringify({ requested, secretsPrinted: false }));
process.exit(0);

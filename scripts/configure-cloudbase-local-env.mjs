import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const region = "ap-shanghai";

const result = spawnSync(
  "npx.cmd",
  [
    "--yes",
    "--cache",
    join(projectRoot, ".npm-cache"),
    "mcporter",
    "call",
    "--stdio",
    "npx",
    "--stdio-arg",
    "-y",
    "--stdio-arg",
    "@cloudbase/cloudbase-mcp@latest",
    "manageAppAuth",
    "action=ensurePublishableKey",
    `envId=${envId}`,
    "--output",
    "json",
    "--timeout",
    "120000",
  ],
  { cwd: projectRoot, encoding: "utf8", windowsHide: true, shell: true },
);

if (result.status !== 0) {
  const detail = result.error?.message ?? result.stderr?.trim() ?? `exit ${String(result.status)}`;
  throw new Error(`Unable to obtain the CloudBase publishable key: ${detail}`);
}

const payload = JSON.parse(result.stdout);
const serialized = JSON.stringify(payload);
const keyMatch = serialized.match(/(?:token|publishableKey|accessKey)\\?"?\s*[:=]\s*\\?"([^"\\]+)/i);
const publishableKey = keyMatch?.[1];
if (!publishableKey) throw new Error("CloudBase returned no publishable key");

const envPath = join(projectRoot, ".env.local");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const values = new Map();
for (const line of existing.split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
}

values.delete("NEXT_PUBLIC_SUPABASE_URL");
values.delete("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
values.delete("SUPABASE_SERVICE_ROLE_KEY");
values.set("NEXT_PUBLIC_CLOUDBASE_ENV_ID", envId);
values.set("NEXT_PUBLIC_CLOUDBASE_REGION", region);
values.set("NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY", publishableKey);

writeFileSync(envPath, `${[...values].map(([key, value]) => `${key}=${value}`).join("\n")}\n`, "utf8");
console.log("CloudBase local environment configured without exposing credentials.");

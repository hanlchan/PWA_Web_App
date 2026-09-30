import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

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

const env = parseEnvFile(join(root, ".env.local"));
const func = {
  name: "next-app",
  type: "HTTP",
  runtime: "Nodejs20.19",
  timeout: 60,
  isWaitInstall: false,
  ignore: [],
  envVariables: {
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
    NEXT_PUBLIC_CLOUDBASE_REGION: env.NEXT_PUBLIC_CLOUDBASE_REGION,
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
  },
};

if (Object.values(func.envVariables).some((value) => !value)) {
  throw new Error("Missing required CloudBase public environment variables");
}

const args = [
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
  "--cwd",
  join(root, ".cloudbase-build"),
  "manageFunctions",
  "action=createFunction",
  `func=${JSON.stringify(func)}`,
  `functionRootPath=${join(root, ".cloudbase-build")}`,
  "force=true",
  "--output",
  "json",
  "--timeout",
  "240000",
];

const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 20 * 1024 * 1024,
});

if (result.error || result.status !== 0) {
  throw new Error(`CloudBase Next.js redeploy failed with exit code ${result.status ?? "unknown"}`);
}

const response = JSON.parse(result.stdout);
if (!response.success) throw new Error(response.message ?? "CloudBase Next.js redeploy failed");
console.log(JSON.stringify({ success: true, function: "next-app", forcedRetry: true }));

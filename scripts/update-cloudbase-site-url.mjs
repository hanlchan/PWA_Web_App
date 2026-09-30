import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const siteUrl = "https://pwa-web-app-d8gpuhess695771e6-1493086646.tcloudbaseapp.com";
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
  "manageFunctions",
  "action=updateFunctionConfig",
  "functionName=next-app",
  `envVariables=${JSON.stringify({ NEXT_PUBLIC_SITE_URL: siteUrl })}`,
  "--output",
  "json",
  "--timeout",
  "120000",
];

const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error || result.status !== 0) {
  throw new Error(`CloudBase site URL update failed with exit code ${result.status ?? "unknown"}`);
}

const response = JSON.parse(result.stdout);
if (!response.success || response.isError) {
  throw new Error(response.message ?? "CloudBase site URL update failed");
}

console.log(JSON.stringify({ success: true, function: "next-app", updated: "NEXT_PUBLIC_SITE_URL" }));

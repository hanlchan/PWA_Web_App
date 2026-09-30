import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base64Path = join(root, ".migration-work", "next-app.zip.base64");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
if (!existsSync(base64Path)) throw new Error("Prepared Next.js ZIP is missing");

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
  "action=updateFunctionCode",
  "functionName=next-app",
  `zipFile=@${base64Path}`,
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
  const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(`CloudBase ZIP deployment failed with exit code ${result.status ?? "unknown"}: ${detail}`);
}
const response = JSON.parse(result.stdout);
if (!response.success) throw new Error(response.message ?? "CloudBase ZIP deployment failed");
console.log(JSON.stringify({ success: true, function: "next-app", package: "prebuilt-zip" }));

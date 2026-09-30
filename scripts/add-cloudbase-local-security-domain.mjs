import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const envId = "pwa-web-app-d8gpuhess695771e6";
const domain = "localhost:3000";
const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

const result = spawnSync(process.execPath, [
  npxCli,
  "--yes",
  "--cache",
  path.join(root, ".npm-cache"),
  "mcporter",
  "call",
  "cloudbase.manageEnv",
  "action=addSecurityDomain",
  `envId=${envId}`,
  `domains=${JSON.stringify([domain])}`,
  "--output",
  "json",
  "--timeout",
  "120000",
], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  windowsHide: true,
});

if (result.error || result.status !== 0) {
  const detail = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[REDACTED_TOKEN]")
    .trim()
    .slice(0, 800);
  throw new Error(`Failed to add CloudBase security domain with exit code ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`);
}

const payload = JSON.parse(result.stdout);
if (payload.ok === false || payload.error || payload.Error) {
  const diagnostic = JSON.stringify(payload)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[REDACTED_TOKEN]")
    .slice(0, 1600);
  throw new Error(`CloudBase rejected or did not confirm the security-domain update: ${diagnostic}`);
}

console.log(JSON.stringify({ submitted: true, domain }));

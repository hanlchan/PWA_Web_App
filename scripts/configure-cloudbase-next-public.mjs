import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const policyPath = join(root, "cloudbase", "policies", "authz.user.rego");
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
  "managePermissions",
  "action=setPolicy",
  `regoContent=@${policyPath}`,
  "confirm=true",
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
  const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(`CloudBase permission update failed with exit code ${result.status ?? "unknown"}: ${detail}`);
}

const response = JSON.parse(result.stdout);
if (!response.success) throw new Error(response.message ?? "CloudBase permission update failed");
console.log(JSON.stringify({ success: true, resource: "next-app", public: true }));

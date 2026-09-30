import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const params = {
  FunctionName: "next-app",
  Namespace: "pwa-web-app-d8gpuhess695771e6",
  MemorySize: 512,
};
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
  "callCloudApi",
  "service=scf",
  "action=UpdateFunctionConfiguration",
  "version=2018-04-16",
  "region=ap-shanghai",
  `params=${JSON.stringify(params)}`,
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
  throw new Error(`CloudBase memory update failed with exit code ${result.status ?? "unknown"}`);
}
const response = JSON.parse(result.stdout);
if (response.Error || response.error) throw new Error("CloudBase memory update failed");
console.log(JSON.stringify({ success: true, function: "next-app", memorySize: 512 }));

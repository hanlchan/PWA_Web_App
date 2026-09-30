import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requestId = process.argv[2];
if (!requestId) throw new Error("Request ID is required");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const params = {
  FunctionName: "next-app",
  FunctionRequestId: requestId,
  Namespace: "pwa-web-app-d8gpuhess695771e6",
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
  "action=GetRequestStatus",
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
  throw new Error(`GetRequestStatus failed with exit code ${result.status ?? "unknown"}`);
}
process.stdout.write(result.stdout);

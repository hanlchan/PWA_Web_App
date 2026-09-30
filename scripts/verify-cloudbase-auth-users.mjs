import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const expected = JSON.parse(await readFile(path.join(root, ".migration-work", "auth-user-map.json"), "utf8"));
const npxCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const result = spawnSync(process.execPath, [
  npxCli,
  "--yes",
  "--cache",
  path.join(root, ".npm-cache"),
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
  "queryPermissions",
  "action=listUsers",
  "pageNo=1",
  "pageSize=100",
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
  throw new Error(`CloudBase Auth verification failed with exit code ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`);
}

const payload = JSON.parse(result.stdout);
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const actual = new Set((JSON.stringify(payload).match(uuidPattern) ?? []).map((uid) => uid.toLowerCase()));
const missing = expected.filter(({ uid }) => !actual.has(uid.toLowerCase()));
if (missing.length > 0) throw new Error(`${missing.length} migrated Auth users are missing`);

console.log(JSON.stringify({ expected: expected.length, verified: expected.length, uuidMappingIntact: true }));

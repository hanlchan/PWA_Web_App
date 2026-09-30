import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testDirectory = join(root, "cloudbase", "tests", "database");
const files = readdirSync(testDirectory).filter((name) => name.endsWith(".sql")).sort();
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

if (files.length === 0) throw new Error("No CloudBase pgTAP files found");

let assertions = 0;
for (const name of files) {
  const sql = readFileSync(join(testDirectory, name), "utf8");
  const plan = sql.match(/select\s+plan\((\d+)\)/i);
  if (plan) assertions += Number(plan[1]);
  const result = spawnSync(process.execPath, [
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
    "managePgDatabase",
    "--args",
    JSON.stringify({ action: "execute", sql, confirm: true }),
    "--output",
    "json",
    "--timeout",
    "120000",
  ], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, TCB_SITE: "domestic" },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.error || result.status !== 0 || /not ok|pgTAP failed|\"success\"\s*:\s*false/i.test(output)) {
    throw new Error(`CloudBase pgTAP failed: ${name}\n${output.trim().slice(0, 2000)}`);
  }
  console.log(`PASS ${name}`);
}

console.log(`All CloudBase pgTAP tests passed: ${files.length} files, ${assertions} assertions.`);

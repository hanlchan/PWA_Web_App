import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testDirectory = join(root, "cloudbase", "tests", "database");
const files = readdirSync(testDirectory).filter((name) => name.endsWith(".sql")).sort();
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const child = spawn(process.execPath, [
  npxCli, "--yes", "--cache", join(root, ".npm-cache"),
  "--package", "@cloudbase/cloudbase-mcp@2.34.6", "cloudbase-mcp",
], {
  cwd: root,
  env: { ...process.env, TCB_SITE: "domestic" },
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let nextId = 1;
let stderrTail = "";
const pending = new Map();
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderrTail = `${stderrTail}${chunk}`.slice(-2000); });
createInterface({ input: child.stdout }).on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id === undefined) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(`MCP ${request.method}: ${message.error.message ?? "unknown error"}`));
  else request.resolve(message.result);
});
child.on("exit", (code) => {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error(`CloudBase MCP exited (${code ?? "unknown"}): ${stderrTail.slice(-400)}`));
  }
  pending.clear();
});

function request(method, params, timeoutMs = 120000) {
  const id = nextId++;
  return new Promise((resolveRequest, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CloudBase MCP ${method} timed out`));
    }, timeoutMs);
    pending.set(id, { method, resolve: resolveRequest, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

try {
  await request("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "pwa-cloudbase-pgtap", version: "1.0.0" },
  }, 30000);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  const listed = await request("tools/list", {}, 30000);
  if (!listed.tools?.some((tool) => tool.name === "managePgDatabase")) {
    throw new Error("CloudBase MCP does not expose managePgDatabase");
  }
  if (process.argv.includes("--describe-pg-tool")) {
    const tool = listed.tools.find((item) => item.name === "managePgDatabase");
    console.log(JSON.stringify(tool?.inputSchema ?? null, null, 2));
  } else if (process.argv.includes("--describe-function-tool")) {
    const tool = listed.tools.find((item) => item.name === "manageFunctions");
    console.log(JSON.stringify(tool ?? null, null, 2));
  } else if (process.argv.includes("--describe-query-function-tool")) {
    const tool = listed.tools.find((item) => item.name === "queryFunctions");
    console.log(JSON.stringify(tool ?? null, null, 2));
  } else if (process.argv.includes("--list-function-tools")) {
    console.log(JSON.stringify(listed.tools
      .filter((tool) => /function|deploy/i.test(`${tool.name} ${tool.description ?? ""}`))
      .map((tool) => ({ name: tool.name, description: (tool.description ?? "").slice(0, 500) })), null, 2));
  } else {
    let assertions = 0;
    for (const name of files) {
      const sql = readFileSync(join(testDirectory, name), "utf8");
      const plan = sql.match(/select\s+plan\((\d+)\)/i);
      if (plan) assertions += Number(plan[1]);
      const result = await request("tools/call", {
        name: "managePgDatabase",
        arguments: { action: "execute", sql, confirm: true },
      });
      const output = (result.content ?? []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
      if (result.isError || /not ok|pgTAP failed|"success"\s*:\s*false/i.test(output)) {
        throw new Error(`CloudBase pgTAP failed: ${name}\n${output.slice(0, 1200)}`);
      }
      console.log(`PASS ${name}`);
    }
    console.log(`All CloudBase pgTAP tests passed: ${files.length} files, ${assertions} assertions.`);
  }
} finally {
  child.stdin.end();
  child.kill();
}

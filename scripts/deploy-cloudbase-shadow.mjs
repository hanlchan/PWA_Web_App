import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const region = "ap-shanghai";
const npmCache = join(root, ".npm-cache");
const migrationDir = join(root, ".migration-work");
const pulledEnvPath = join(migrationDir, "vercel-production.env");
const localEnvPath = join(root, ".env.local");

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}`);
  }

  return result.stdout;
}

function findNpxCli() {
  const candidates = [
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
  ];
  const match = candidates.find(existsSync);
  if (!match) throw new Error("Unable to locate npx-cli.js");
  return match;
}

const npxCli = findNpxCli();

function callMcp(tool, args) {
  const cliArgs = [
    npxCli,
    "--yes",
    "--cache",
    npmCache,
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
    tool,
    ...Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`),
    "--output",
    "json",
    "--timeout",
    "120000",
  ];
  const output = run(process.execPath, cliArgs);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`CloudBase MCP returned an invalid response for ${tool}`);
  }
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value.replace(/\\n/g, "\n");
  }
  return values;
}

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function generateVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  // VAPID uses the uncompressed P-256 point and the 32-byte private scalar.
  return {
    publicKey: toBase64Url(publicKey.subarray(publicKey.length - 65)),
    privateKey: toBase64Url(privateKey.subarray(privateKey.length - 32)),
  };
}

function writeLocalEnvValue(key, value) {
  const current = existsSync(localEnvPath) ? readFileSync(localEnvPath, "utf8") : "";
  const lines = current.split(/\r?\n/).filter((line) => line && !line.startsWith(`${key}=`));
  lines.push(`${key}=${value}`);
  writeFileSync(localEnvPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
}

function obtainVapidKeys() {
  const local = parseEnvFile(localEnvPath);
  if (local.VAPID_PUBLIC_KEY && local.VAPID_PRIVATE_KEY) {
    return { publicKey: local.VAPID_PUBLIC_KEY, privateKey: local.VAPID_PRIVATE_KEY, source: "local" };
  }

  mkdirSync(migrationDir, { recursive: true });
  const pullResult = run(process.execPath, [
    npxCli,
    "--yes",
    "vercel@latest",
    "env",
    "pull",
    pulledEnvPath,
    "--environment=production",
    "--yes",
  ], { allowFailure: true });
  if (pullResult !== null) {
    const pulled = parseEnvFile(pulledEnvPath);
    if (pulled.VAPID_PUBLIC_KEY && pulled.VAPID_PRIVATE_KEY) {
      writeLocalEnvValue("VAPID_PUBLIC_KEY", pulled.VAPID_PUBLIC_KEY);
      return { publicKey: pulled.VAPID_PUBLIC_KEY, privateKey: pulled.VAPID_PRIVATE_KEY, source: "vercel" };
    }
  }

  const generated = generateVapidKeys();
  writeLocalEnvValue("VAPID_PUBLIC_KEY", generated.publicKey);
  return { ...generated, source: "generated" };
}

function assertSuccess(result, label) {
  if (!result || result.success === false || result.isError) {
    throw new Error(`${label} failed`);
  }
}

function createFunction(func, functionRootPath) {
  const result = callMcp("manageFunctions", {
    action: "createFunction",
    func,
    functionRootPath,
    handler: func.type === "Event" ? "index.main" : undefined,
    force: false,
  });
  assertSuccess(result, `Deploy ${func.name}`);
  return result;
}

const vapid = obtainVapidKeys();
const pulled = parseEnvFile(pulledEnvPath);
const localAfterVapid = parseEnvFile(localEnvPath);
const vapidSubject = pulled.VAPID_SUBJECT ?? localAfterVapid.VAPID_SUBJECT ?? "mailto:cloudbase-migration@invalid.example";
const apiKeyResult = callMcp("manageAppAuth", {
  action: "createApiKey",
  keyType: "api_key",
  keyName: "pwa-web-app-functions",
  expireIn: 0,
});
assertSuccess(apiKeyResult, "Create server API key");
const apiKey = apiKeyResult.apiKey ?? apiKeyResult.key ?? apiKeyResult.token ?? apiKeyResult.data?.apiKey ?? apiKeyResult.data?.key;
if (!apiKey) throw new Error("CloudBase did not return the new server API key");

const sharedFunctionEnv = {
  CLOUDBASE_ENV_ID: envId,
  CLOUDBASE_APIKEY: apiKey,
};

createFunction({
  name: "generate-occurrences",
  type: "Event",
  runtime: "Nodejs20.19",
  timeout: 60,
  handler: "index.main",
  envVariables: sharedFunctionEnv,
  isWaitInstall: true,
}, join(root, "cloudfunctions"));

createFunction({
  name: "send-workout-reminders",
  type: "Event",
  runtime: "Nodejs20.19",
  timeout: 120,
  handler: "index.main",
  envVariables: {
    ...sharedFunctionEnv,
    VAPID_SUBJECT: vapidSubject,
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  },
  isWaitInstall: true,
}, join(root, "cloudfunctions"));

const local = parseEnvFile(localEnvPath);
createFunction({
  name: "next-app",
  type: "HTTP",
  runtime: "Nodejs20.19",
  timeout: 60,
  envVariables: {
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: envId,
    NEXT_PUBLIC_CLOUDBASE_REGION: region,
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: local.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: local.NEXT_PUBLIC_SITE_URL ?? "",
    VAPID_PUBLIC_KEY: vapid.publicKey,
  },
}, join(root, ".cloudbase-build"));

console.log(JSON.stringify({
  success: true,
  functions: ["generate-occurrences", "send-workout-reminders", "next-app"],
  vapidSource: vapid.source,
  timersCreated: false,
  productionTrafficChanged: false,
}));

import { createHash, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const envId = "pwa-web-app-d8gpuhess695771e6";

function getTemporaryCredential() {
  const result = spawnSync(process.execPath, [
    npxCli, "--yes", "--cache", join(root, ".npm-cache"),
    "--package", "@cloudbase/cli", "tcb", "secrets", "get", "-e", envId, "--json",
  ], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`CloudBase temporary credential request failed with exit code ${result.status ?? "unknown"}`);
  const credential = JSON.parse(result.stdout).data;
  if (!credential?.secretId || !credential?.secretKey || !credential?.token || credential.envId !== envId) {
    throw new Error("CloudBase did not return complete credentials for the target environment");
  }
  return credential;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

const contentType = "application/json; charset=utf-8";
const signedHeaders = "content-type;host;x-tc-action";
async function callCloudBaseApi(action, request, credential, {
  service = "tcb",
  host = "tcb.tencentcloudapi.com",
  version = "2018-06-08",
  region,
} = {}) {
  const payload = JSON.stringify(request);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  const secretDate = hmac(`TC3${credential.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${credential.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      Host: host,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Token": credential.token,
      ...(region ? { "X-TC-Region": region } : {}),
    },
    body: payload,
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  const api = body.Response ?? body;
  if (!response.ok || api.Error || api.SCFErrorCode) {
    throw new Error(`CloudBase ${action} failed: ${api.Error?.Code ?? api.SCFErrorCode ?? `HTTP_${response.status}`}`);
  }
  return api;
}

const zipPath = join(root, ".migration-work", "next-app.zip");
const zipBytes = statSync(zipPath).size;
if (zipBytes > 20 * 1024 * 1024) throw new Error("ZIP exceeds the documented 20 MB UpdateFunctionCode limit");
const apply = process.argv.includes("--apply-shadow-next-app");
if (!process.argv.includes("--probe") && !apply) {
  console.log(JSON.stringify({ mode: "dry-run", function: "next-app", zipBytes, installDependency: false }));
  process.exit(0);
}

const credential = getTemporaryCredential();
const detail = await callCloudBaseApi("GetFunction", { EnvId: envId, FunctionName: "next-app", Namespace: envId }, credential);
if (detail.FunctionName !== "next-app" || detail.Namespace !== envId || detail.Status !== "Active"
    || detail.Type !== "HTTP" || detail.InstallDependency !== "FALSE") {
  throw new Error("Target function configuration differs from the expected HTTP standalone deployment");
}
console.log(JSON.stringify({ mode: "probe", function: "next-app", status: detail.Status, modTime: detail.ModTime }));
if (apply) {
  const updated = await callCloudBaseApi("UpdateFunctionCode", {
    FunctionName: "next-app",
    EnvId: envId,
    CodeSource: "ZipFile",
    Code: { ZipFile: readFileSync(zipPath).toString("base64") },
    InstallDependency: "FALSE",
    Publish: "FALSE",
  }, credential);
  console.log(JSON.stringify({ mode: "updated", function: "next-app", requestId: updated.RequestId ?? null }));
}

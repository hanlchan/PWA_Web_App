import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
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
  "queryFunctions",
  "action=getFunctionDownloadUrl",
  "functionName=next-app",
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
if (result.error || result.status !== 0) throw new Error("Unable to obtain function package URL");
const response = JSON.parse(result.stdout);

function findUrl(value) {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findUrl(item);
      if (found) return found;
    }
  }
  return null;
}

const url = findUrl(response);
if (!url) throw new Error("Function package URL was not returned");
const download = await fetch(url);
if (!download.ok) throw new Error(`Function package download failed with HTTP ${download.status}`);
const zip = Buffer.from(await download.arrayBuffer());

let bootstrap = null;
let entries = 0;
const cloudFiles = new Set();
for (let offset = 0; offset <= zip.length - 46; offset += 1) {
  if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
  entries += 1;
  const madeBy = zip.readUInt16LE(offset + 4);
  const externalAttributes = zip.readUInt32LE(offset + 38);
  const nameLength = zip.readUInt16LE(offset + 28);
  const extraLength = zip.readUInt16LE(offset + 30);
  const commentLength = zip.readUInt16LE(offset + 32);
  const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
  const normalizedName = name.replace(/^\.\//, "").replace(/\/$/, "");
  if (normalizedName) cloudFiles.add(normalizedName);
  if (name.replace(/^\.\//, "") === "scf_bootstrap") {
    bootstrap = {
      creatorSystem: madeBy >> 8,
      unixMode: ((externalAttributes >>> 16) & 0xffff).toString(8),
      executable: (((externalAttributes >>> 16) & 0o111) !== 0),
    };
  }
  offset += 45 + nameLength + extraLength + commentLength;
}

const source = join(root, ".cloudbase-build", "next-app");
const localFiles = readdirSync(source, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name).slice(source.length + 1).replaceAll("\\", "/"));
const missing = localFiles.filter((name) => !cloudFiles.has(name));
const critical = [
  "server.js",
  "package.json",
  "scf_bootstrap",
  "node_modules/next/package.json",
  "node_modules/react/package.json",
  "node_modules/react-dom/package.json",
];

console.log(JSON.stringify({
  success: true,
  zipBytes: zip.length,
  entries,
  bootstrap,
  localFileCount: localFiles.length,
  cloudFileCount: cloudFiles.size,
  missingFileCount: missing.length,
  missingExamples: missing.slice(0, 30),
  critical: Object.fromEntries(critical.map((name) => [name, cloudFiles.has(name)])),
}));

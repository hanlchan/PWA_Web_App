import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, ".cloudbase-build", "next-app");
const work = join(root, ".migration-work");
const zipPath = join(work, "next-app.zip");
const base64Path = join(work, "next-app.zip.base64");

if (!existsSync(join(source, "scf_bootstrap")) || !existsSync(join(source, "server.js"))) {
  throw new Error("CloudBase Next.js bundle is incomplete");
}

mkdirSync(work, { recursive: true });
for (const path of [zipPath, base64Path]) {
  if (existsSync(path)) rmSync(path);
}

const archive = spawnSync(
  "C:\\Windows\\System32\\tar.exe",
  ["-a", "-c", "-f", zipPath, "-C", source, "server.js", "package.json", "scf_bootstrap", ".next", "node_modules", "public"],
  {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  },
);
if (archive.error || archive.status !== 0) {
  throw new Error(`ZIP creation failed with exit code ${archive.status ?? "unknown"}`);
}

const zip = readFileSync(zipPath);
const signature = 0x02014b50;
let executableEntryFound = false;
for (let offset = 0; offset <= zip.length - 46; offset += 1) {
  if (zip.readUInt32LE(offset) !== signature) continue;
  const nameLength = zip.readUInt16LE(offset + 28);
  const extraLength = zip.readUInt16LE(offset + 30);
  const commentLength = zip.readUInt16LE(offset + 32);
  const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
  if (name.replace(/^\.\//, "") === "scf_bootstrap") {
    zip.writeUInt16LE((3 << 8) | 30, offset + 4); // Unix, ZIP spec 3.0
    zip.writeUInt32LE(((0o100755 << 16) | 0x20) >>> 0, offset + 38);
    executableEntryFound = true;
  }
  offset += 45 + nameLength + extraLength + commentLength;
}

if (!executableEntryFound) throw new Error("scf_bootstrap was not found in ZIP central directory");
writeFileSync(zipPath, zip);
writeFileSync(base64Path, zip.toString("base64"), { encoding: "ascii", mode: 0o600 });
console.log(JSON.stringify({ success: true, zipBytes: zip.length, bootstrapMode: "100755" }));

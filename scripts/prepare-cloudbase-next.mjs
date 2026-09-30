import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const standalone = join(root, ".next", "standalone");
const target = join(root, ".cloudbase-build", "next-app");
if (!existsSync(join(standalone, "server.js"))) {
  throw new Error("Missing .next/standalone/server.js; run npm run build first");
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(standalone, target, { recursive: true });
cpSync(join(root, ".next", "static"), join(target, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(target, "public"), { recursive: true });

// Next.js standalone already contains its traced runtime dependencies. Keep the
// function package manifest dependency-free so CloudBase does not reinstall the
// project's development toolchain during every deployment.
writeFileSync(
  join(target, "package.json"),
  `${JSON.stringify({ name: "pwa-web-app-cloudbase", version: "1.0.0", private: true, type: "module" }, null, 2)}\n`,
  "utf8",
);

const bootstrap = readFileSync(join(root, "cloudbase", "next", "scf_bootstrap"), "utf8").replace(/\r\n/g, "\n");
writeFileSync(join(target, "scf_bootstrap"), bootstrap, "utf8");
console.log("CloudBase Next.js HTTP function bundle prepared in .cloudbase-build/next-app.");

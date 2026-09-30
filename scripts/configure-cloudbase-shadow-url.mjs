import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "..", ".env.local");
const shadowUrl = "https://pwa-web-app-d8gpuhess695771e6-1493086646.tcloudbaseapp.com";
const lines = readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("NEXT_PUBLIC_SITE_URL="));
lines.push(`NEXT_PUBLIC_SITE_URL=${shadowUrl}`);
writeFileSync(envPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
console.log("CloudBase shadow URL configured locally without exposing secrets.");

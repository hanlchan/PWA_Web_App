import { performance } from "node:perf_hooks";

const origin = "https://pwa-web-app-d8gpuhess695771e6-1493086646.tcloudbaseapp.com";
const paths = [
  "/",
  "/login",
  "/forgot-password",
  "/api/push/public-key",
  "/manifest.webmanifest",
  "/offline",
];

async function measure(path) {
  const startedAt = performance.now();
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    headers: { "cache-control": "no-cache" },
  });
  const headersAt = performance.now();
  await response.arrayBuffer();
  const completedAt = performance.now();
  return {
    path,
    status: response.status,
    ttfbMs: Math.round(headersAt - startedAt),
    totalMs: Math.round(completedAt - startedAt),
  };
}

const results = [];
for (const path of paths) {
  results.push(await measure(path));
  results.push(await measure(path));
}

console.log(JSON.stringify({ origin, samplesPerPath: 2, results }, null, 2));

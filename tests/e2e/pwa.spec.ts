import { expect, test } from "@playwright/test";

import { openAppPage } from "./cloudbase-test-domain";

test("serves an installable manifest and a non-cacheable service worker", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "运动打卡",
    short_name: "运动打卡",
    display: "standalone",
  });
  expect(manifest.icons).toHaveLength(3);

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["content-type"]).toContain("application/javascript");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["content-security-policy"]).toContain("connect-src 'self'");
  const workerSource = await worker.text();
  expect(workerSource).toContain("const OFFLINE_URL = \"/offline\"");
  expect(workerSource).toContain('self.addEventListener("push"');
  expect(workerSource).toContain('self.addEventListener("notificationclick"');
});

test("public pages do not request the retired platforms", async ({ page }) => {
  const legacyRequests: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host === "vercel.app" || host.endsWith(".vercel.app")
      || host === "supabase.co" || host.endsWith(".supabase.co")) {
      legacyRequests.push(request.url());
    }
  });

  await openAppPage(page, "/login");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await openAppPage(page, "/register");
  await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();
  await openAppPage(page, "/offline");
  await expect(page.getByRole("heading", { name: "当前处于离线状态" })).toBeVisible();

  expect(legacyRequests).toEqual([]);
});

test("service worker serves offline fallback without caching private routes", async ({ page, context }) => {
  await openAppPage(page, "/login");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration("/"))))
    .toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "当前处于离线状态" })).toBeVisible();

  const cachedPaths = await page.evaluate(async () => {
    const cachesByName = await Promise.all((await caches.keys()).map((name) => caches.open(name)));
    const requests = (await Promise.all(cachesByName.map((cache) => cache.keys()))).flat();
    return requests.map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths).toContain("/offline");
  expect(cachedPaths.some((path) => path === "/login" || path === "/plans" || path.startsWith("/api/")))
    .toBe(false);
});

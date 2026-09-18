import { expect, test } from "@playwright/test";

test("serves an installable manifest and a non-cacheable service worker", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "好友运动打卡",
    short_name: "运动打卡",
    display: "standalone",
  });
  expect(manifest.icons).toHaveLength(3);

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["content-type"]).toContain("application/javascript");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(await worker.text()).toContain("const OFFLINE_URL = \"/offline\"");
});

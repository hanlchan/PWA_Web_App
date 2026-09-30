import { expect, test } from "@playwright/test";

import { openAppPage } from "./cloudbase-test-domain";

test("public login page has no horizontal overflow", async ({ page }) => {
  await openAppPage(page, "/login");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
});

test("offline fallback is readable", async ({ page }) => {
  await openAppPage(page, "/offline");
  await expect(page.getByRole("heading", { name: "当前处于离线状态" })).toBeVisible();
});

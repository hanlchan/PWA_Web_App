import { expect, test } from "@playwright/test";

test("public login page has no horizontal overflow", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
});

test("offline fallback is readable", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "当前处于离线状态" })).toBeVisible();
});

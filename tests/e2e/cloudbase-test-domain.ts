import type { Page } from "@playwright/test";

export async function openAppPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (response?.status() !== 404) return;

  const continueButton = page.getByRole("button", { name: /确定访问/ });
  if (!await continueButton.isVisible().catch(() => false)) return;

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    continueButton.click(),
  ]);
}

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const users = JSON.parse(readFileSync(join(root, ".migration-work", "auth-user-map.json"), "utf8"));
const email = users?.[0]?.email;
if (typeof email !== "string" || !email.includes("@")) throw new Error("Migrated email mapping is unavailable");

const origin = "https://pwa-web-app-d8gpuhess695771e6-1493086646.tcloudbaseapp.com";
const browser = await chromium.launch({
  args: ["--no-proxy-server"],
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    console.log(JSON.stringify({
      step: "request_failed",
      target: `${url.origin}${url.pathname}`,
      reason: request.failure()?.errorText ?? "unknown",
    }));
  });
  page.on("pageerror", (error) => {
    console.log(JSON.stringify({ step: "page_error", message: error.message }));
  });
  console.log(JSON.stringify({ step: "browser_started" }));
  const response = await page.goto(`${origin}/forgot-password`, { waitUntil: "domcontentloaded" });
  console.log(JSON.stringify({
    step: "page_loaded",
    status: response?.status() ?? null,
    finalUrl: page.url(),
    body: (await page.locator("body").innerText()).slice(0, 200),
  }));
  if (response?.status() === 404) {
    console.log(JSON.stringify({
      step: "interstitial_controls",
      links: await page.locator("a").allInnerTexts(),
      buttons: await page.locator("button").allInnerTexts(),
    }));
    const continueButton = page.getByRole("button", { name: /确定访问/ });
    await continueButton.waitFor({ state: "visible" });
    await page.waitForTimeout(3_500);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      continueButton.click(),
    ]);
    await page.waitForTimeout(1_000);
    console.log(JSON.stringify({
      step: "interstitial_accepted",
      path: new URL(page.url()).pathname,
    }));
  }
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "发送重置验证码" }).click({ noWaitAfter: true });
  console.log(JSON.stringify({ step: "reset_requested" }));
  await Promise.race([
    page.getByLabel("邮箱验证码").waitFor({ state: "visible", timeout: 20_000 }),
    page.locator('form p[role="alert"]').waitFor({ state: "visible", timeout: 20_000 }).then(async () => {
      throw new Error(`CloudBase reset rejected: ${await page.locator('form p[role="alert"]').innerText()}`);
    }),
  ]);
  console.log(JSON.stringify({ browserResetRequest: "passed", secretsPrinted: false }));
} finally {
  await browser.close();
}

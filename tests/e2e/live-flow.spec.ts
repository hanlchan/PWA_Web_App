import { expect, test } from "@playwright/test";

import { openAppPage } from "./cloudbase-test-domain";

async function testImage(page: import("@playwright/test").Page, label: string, color: string) {
  const dataUrl = await page.evaluate(({ label: text, color: fill }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for test image");
    context.fillStyle = fill;
    context.fillRect(0, 0, 160, 160);
    context.fillStyle = "#ffffff";
    context.font = "bold 42px sans-serif";
    context.fillText(text, 24, 96);
    return canvas.toDataURL("image/png");
  }, { label, color });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

const live = process.env.LIVE_CLOUDBASE_E2E === "1";
const email = process.env.LIVE_CLOUDBASE_E2E_EMAIL?.trim();
const password = process.env.LIVE_CLOUDBASE_E2E_PASSWORD;
const username = process.env.LIVE_CLOUDBASE_E2E_USERNAME ?? `browser_${Date.now().toString().slice(-10)}`;
const registrationEmail = process.env.LIVE_E2E_REGISTRATION_EMAIL?.trim();

test.describe("live CloudBase user flow", () => {
  test.skip(!live, "Live CloudBase E2E is not enabled");

  test("starts registration through the public email verification form", async ({ page }) => {
    test.skip(!registrationEmail || !password, "Set a real registration email and password to test email delivery");
    await openAppPage(page, "/register");
    await page.getByLabel("邮箱").fill(registrationEmail!);
    await page.getByLabel("密码", { exact: true }).fill(password!);
    await page.getByLabel("确认密码").fill(password!);
    await page.getByRole("button", { name: "发送注册验证码" }).click();
    await expect(page.getByLabel("邮箱验证码")).toBeVisible();
  });

  test("onboards, creates a plan, checks in, edits and deletes a plan, tracks weight, and signs out", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!email || !password, "Set credentials for a fresh CloudBase E2E user without a profile");
    await openAppPage(page, "/login");
    await page.getByLabel("邮箱").fill(email!);
    await page.getByLabel("密码", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });

    await page.getByLabel("用户名").fill(username);
    await page.getByLabel("昵称").fill("浏览器验收用户");
    await page.getByLabel("身高 cm（可选）").fill("170");
    await page.getByLabel("所在时区").fill("Asia/Shanghai");
    await page.getByLabel("头像（可选）").setInputFiles({
      name: "avatar-test.png", mimeType: "image/png", buffer: await testImage(page, "AV", "#059669"),
    });
    await page.getByRole("button", { name: "完成设置" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("你还没有安排运动计划")).toBeVisible();
    await page.getByRole("link", { name: "我的" }).click();
    const avatar = page.getByRole("img", { name: "头像" });
    await expect(avatar).toBeVisible();
    await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("link", { name: "首页" }).click();

    await page.getByRole("link", { name: "创建第一个计划" }).click();
    await expect(page.getByRole("heading", { name: "创建运动计划" })).toBeVisible();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
    await page.getByLabel("计划名称 *").fill("浏览器端到端计划");
    await page.getByLabel("开始日期").fill(today);
    await page.getByRole("button", { name: "保存计划" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByText("浏览器端到端计划")).toBeVisible();

    await page.getByRole("link", { name: "首页" }).click();
    await expect(page.getByRole("heading", { name: "浏览器端到端计划" })).toBeVisible();
    await page.getByRole("button", { name: "✓ 完成今日运动" }).click();
    await expect(page.getByRole("button", { name: "✓ 已完成 · 撤销" })).toBeVisible();

    await page.getByRole("link", { name: "记录" }).click();
    await page.getByRole("link", { name: `查看 ${today} 记录` }).click();
    await expect(page.getByRole("heading", { name: "当天计划" })).toBeVisible();
    await expect(page.getByText("✓ 已完成")).toBeVisible();
    await expect(page.getByText("计划打卡")).toBeVisible();

    await page.getByRole("link", { name: "首页" }).click();
    await page.getByRole("button", { name: "✓ 已完成 · 撤销" }).click();
    await expect(page.getByRole("button", { name: "✓ 完成今日运动" })).toBeVisible();

    await page.getByRole("link", { name: "计划" }).click();
    await page.getByRole("link", { name: /浏览器端到端计划/ }).click();
    await expect(page.getByRole("heading", { name: "编辑计划" })).toBeVisible();
    await page.getByLabel("计划名称 *").fill("浏览器端到端计划已修改");
    await page.getByRole("button", { name: "保存计划" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByText("浏览器端到端计划已修改")).toBeVisible();
    await page.getByRole("link", { name: /浏览器端到端计划已修改/ }).click();
    await page.getByRole("button", { name: "删除计划" }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByText("还没有运动计划")).toBeVisible();

    await page.getByRole("link", { name: "我的" }).click();
    await page.getByRole("link", { name: "体重与 BMI" }).click();
    await page.getByLabel("体重 kg").fill("70.5");
    await page.getByRole("button", { name: "保存体重" }).click();
    await expect(page.getByText("70.5 kg").first()).toBeVisible();
    await expect(page.getByText(/BMI 24/).first()).toBeVisible();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText("暂无记录")).toBeVisible();

    await page.getByRole("link", { name: "我的" }).click();
    await page.getByRole("link", { name: "我的变化照片" }).click();
    await page.getByLabel("选择照片").setInputFiles({
      name: "progress-test.png", mimeType: "image/png", buffer: await testImage(page, "PH", "#2563eb"),
    });
    await page.getByLabel("简短备注（可选）").fill("CloudBase E2E 私密照片");
    await page.getByRole("button", { name: "保存照片" }).click();
    await expect(page.getByText("照片已保存")).toBeVisible({ timeout: 20_000 });
    const photo = page.getByRole("img", { name: "CloudBase E2E 私密照片" });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    const anonymousContext = await page.context().browser()!.newContext();
    try {
      const anonymous = await anonymousContext.newPage();
      await openAppPage(anonymous, `/u/${username}`);
      await expect(anonymous.getByText("CloudBase E2E 私密照片")).toHaveCount(0);

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "设为公开" }).click();
      await expect(page.getByText("照片已设为公开")).toBeVisible();
      await anonymous.reload();
      const publicPhoto = anonymous.getByRole("img", { name: "CloudBase E2E 私密照片" });
      await expect(publicPhoto).toBeVisible();
      await expect.poll(() => publicPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

      await page.getByRole("button", { name: "转为仅自己" }).click();
      await expect(page.getByText("照片已转为仅自己")).toBeVisible();
      await anonymous.reload();
      await expect(anonymous.getByText("CloudBase E2E 私密照片")).toHaveCount(0);
    } finally {
      await anonymousContext.close();
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText("还没有照片记录")).toBeVisible();

    await page.getByRole("link", { name: "我的" }).click();
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

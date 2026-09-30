import { expect, test, type Page } from "@playwright/test";

import { openAppPage } from "./cloudbase-test-domain";

const enabled = process.env.LIVE_CLOUDBASE_E2E === "1";
const first = {
  uid: process.env.LIVE_CLOUDBASE_E2E_UID,
  email: process.env.LIVE_CLOUDBASE_E2E_EMAIL,
  password: process.env.LIVE_CLOUDBASE_E2E_PASSWORD,
  username: process.env.LIVE_CLOUDBASE_E2E_USERNAME,
};
const second = {
  email: process.env.LIVE_CLOUDBASE_E2E_OTHER_EMAIL,
  password: process.env.LIVE_CLOUDBASE_E2E_OTHER_PASSWORD,
  username: process.env.LIVE_CLOUDBASE_E2E_OTHER_USERNAME,
};

async function onboard(page: Page, account: Pick<typeof first, "email" | "password" | "username">, displayName: string) {
  await openAppPage(page, "/login");
  await page.getByLabel("邮箱").fill(account.email!);
  await page.getByLabel("密码", { exact: true }).fill(account.password!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
  await page.getByLabel("用户名").fill(account.username!);
  await page.getByLabel("昵称").fill(displayName);
  await page.getByLabel("身高 cm（可选）").fill("170");
  await page.getByLabel("所在时区").fill("Asia/Shanghai");
  await page.getByRole("button", { name: "完成设置" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

async function testImage(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for test image");
    context.fillStyle = "#7c3aed";
    context.fillRect(0, 0, 160, 160);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

function safeJwtClaims(token?: string) {
  try {
    const body = token?.split(".")[1];
    if (!body) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    return { sub: claims.sub, role: claims.role, aud: claims.aud, keys: Object.keys(claims).sort() };
  } catch {
    return null;
  }
}

test("two disposable CloudBase users keep private data isolated and use social actions", async ({ page, browser }) => {
  test.setTimeout(180_000);
  test.skip(!enabled || !first.email || !first.password || !first.username || !second.email || !second.password || !second.username,
    "Two fresh disposable CloudBase accounts are required");

  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await onboard(other, second, "双账号测试 B");
    await other.getByRole("link", { name: "我的" }).click();
    await other.getByRole("link", { name: "体重与 BMI" }).click();
    await other.getByLabel("体重 kg").fill("73.7");
    await other.getByRole("button", { name: "保存体重" }).click();
    await expect(other.getByText("73.7 kg").first()).toBeVisible();

    await other.getByRole("link", { name: "我的" }).click();
    await other.getByRole("link", { name: "我的变化照片" }).click();
    await other.getByLabel("选择照片").setInputFiles({
      name: "cross-user-private.png", mimeType: "image/png", buffer: await testImage(other),
    });
    await other.getByLabel("简短备注（可选）").fill("双账号私密照片");
    await other.getByRole("button", { name: "保存照片" }).click();
    await expect(other.getByText("照片已保存")).toBeVisible({ timeout: 20_000 });
    await expect(other.getByRole("img", { name: "双账号私密照片" })).toBeVisible();

    await other.getByRole("link", { name: "首页" }).click();
    await other.getByRole("link", { name: "创建第一个计划" }).click();
    await other.getByLabel("计划名称 *").fill("双账号测试计划");
    await other.getByRole("button", { name: "保存计划" }).click();
    await expect(other).toHaveURL(/\/plans$/);
    await other.getByRole("link", { name: "首页" }).click();
    await other.getByRole("button", { name: "✓ 完成今日运动" }).click();
    await expect(other.getByRole("button", { name: "✓ 已完成 · 撤销" })).toBeVisible();
    await openAppPage(other, "/plans/new");
    await other.getByLabel("计划名称 *").fill("双账号待完成计划");
    await other.getByRole("button", { name: "保存计划" }).click();
    await expect(other).toHaveURL(/\/plans$/);

    await onboard(page, first, "双账号测试 A");
    await openAppPage(page, `/u/${second.username}`);
    await expect(page.getByText("双账号私密照片")).toHaveCount(0);
    await expect(page.getByText("73.7 kg")).toHaveCount(0);
    await openAppPage(page, "/photos");
    await expect(page.getByText("还没有照片记录")).toBeVisible();
    await openAppPage(page, "/notifications");
    await expect(page.getByText("暂无通知")).toBeVisible();

    await openAppPage(page, `/feed?q=${second.username}`);
    await expect(page.getByText(`@${second.username}`).first()).toBeVisible();
    await page.getByRole("button", { name: "关注", exact: true }).click();
    await expect(page.getByRole("button", { name: "取消关注" })).toBeVisible();
    await page.reload();
    const checkin = page.getByRole("article").filter({ hasText: "今天完成运动" });
    await expect(checkin).toContainText(`@${second.username}`);
    const nudge = checkin.getByRole("button", { name: "🔥 催TA运动" });
    await nudge.click();
    await expect(nudge).toBeEnabled({ timeout: 15_000 });
    const nudgeError = await checkin.getByRole("alert").count() ? await checkin.getByRole("alert").textContent() : null;
    expect(nudgeError, `Nudge action failed: ${nudgeError}`).toBeNull();
    await openAppPage(other, "/notifications");
    await expect.poll(async () => {
      await other.reload();
      return other.getByText(/催你去运动了/).count();
    }, { timeout: 20_000 }).toBe(1);
    await nudge.click();
    await expect(checkin.getByRole("alert")).toBeVisible();
    await other.reload();
    await expect(other.getByText(/催你去运动了/)).toHaveCount(1);
    await checkin.getByRole("button", { name: "❤️ 0" }).click();
    await expect(checkin.getByRole("button", { name: "❤️ 1" })).toBeVisible();

    await openAppPage(other, "/notifications");
    await expect(other.getByText(/点赞了你的打卡/)).toBeVisible();
    await other.getByRole("button", { name: "全部已读" }).click();
    await expect(other.getByRole("button", { name: "全部已读" })).toHaveCount(0);
    await openAppPage(page, "/notifications");
    await expect(page.getByText("暂无通知")).toBeVisible();

    await openAppPage(page, `/feed?q=${second.username}`);
    await page.getByRole("article").filter({ hasText: "今天完成运动" }).getByRole("button", { name: "❤️ 1" }).click();
    await expect(page.getByRole("article").filter({ hasText: "今天完成运动" }).getByRole("button", { name: "❤️ 0" })).toBeVisible();
    await page.getByRole("button", { name: "取消关注" }).click();
    await expect(page.getByRole("button", { name: "关注", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("article").filter({ hasText: "今天完成运动" })).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});

test("fresh temporary account survives a forced server session refresh without losing its profile", async ({ page }) => {
  test.setTimeout(90_000);
  test.skip(!enabled || !first.uid || !first.email || !first.password || !first.username,
    "A fresh disposable CloudBase account is required");
  await onboard(page, first, "会话刷新测试用户");
  const originalAccess = (await page.context().cookies()).find((cookie) => cookie.name === "cloudbase_access_token");
  const originalRefresh = (await page.context().cookies()).find((cookie) => cookie.name === "cloudbase_refresh_token");
  expect(originalAccess?.value).toBeTruthy();
  expect(originalRefresh?.value).toBeTruthy();
  const origin = `https://pwa-web-app-d8gpuhess695771e6.api.tcloudbasegateway.com`;
  const beforeProfile = await page.request.get(`${origin}/v1/rdb/rest/profiles?id=eq.${first.uid}&select=id`, {
    headers: { Authorization: `Bearer ${originalAccess!.value}` },
  });
  const beforeProfileBody = beforeProfile.ok() ? await beforeProfile.json() as { id: string }[] : null;
  await page.context().addCookies([{
    name: "cloudbase_expires_at",
    value: String(Date.now() + 10_000),
    domain: new URL(page.url()).hostname,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 3600,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }]);
  await page.reload();
  if (new URL(page.url()).pathname === "/login") {
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    const clearedCookies = await page.context().cookies();
    expect(clearedCookies.some((cookie) => cookie.name === "cloudbase_access_token")).toBe(false);
    expect(clearedCookies.some((cookie) => cookie.name === "cloudbase_refresh_token")).toBe(false);

    await page.getByLabel("邮箱").fill(first.email!);
    await page.getByLabel("密码", { exact: true }).fill(first.password!);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  } else {
    await expect(page).toHaveURL(/\/$/);
    const cookies = await page.context().cookies();
    const refreshedExpiry = cookies.find((cookie) => cookie.name === "cloudbase_expires_at")?.value;
    expect(Number(refreshedExpiry)).toBeGreaterThan(Date.now() + 60_000);
  }
  await expect(page.getByText("你还没有安排运动计划")).toBeVisible();
  const restoredAccess = (await page.context().cookies()).find((cookie) => cookie.name === "cloudbase_access_token")?.value;
  expect(restoredAccess).toBeTruthy();
  expect(safeJwtClaims(restoredAccess)?.role).toBe("authenticated");
  expect(safeJwtClaims(restoredAccess)?.sub).toBe(first.uid);
  const profile = await page.request.get(`${origin}/v1/rdb/rest/profiles?id=eq.${first.uid}&select=id`, {
    headers: { Authorization: `Bearer ${restoredAccess}` },
  });
  const profileBody = profile.ok() ? await profile.json() as { id: string }[] : null;
  expect(beforeProfileBody?.some((row) => row.id === first.uid)).toBe(true);
  expect(profileBody?.some((row) => row.id === first.uid)).toBe(true);
});

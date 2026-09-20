import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const live = process.env.LIVE_SUPABASE_E2E === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("live Supabase user flow", () => {
  test.skip(!live || !url || !publishableKey || !serviceRoleKey, "Live Supabase credentials are not enabled");

  const runId = `${Date.now()}`.slice(-10);
  const email = `codex-browser-${runId}@example.invalid`;
  const registrationEmail = process.env.LIVE_E2E_REGISTRATION_EMAIL?.trim();
  const password = `Browser-${runId}-Aa9!`;
  const username = `browser_${runId}`;
  let userId = "";
  let registrationEmailWasAvailable = true;

  const admin = url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  test.beforeAll(async () => {
    if (!admin) return;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "Unable to create browser test user");
    userId = data.user.id;
    if (registrationEmail) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw new Error(`Unable to inspect registration test user: ${listError.message}`);
      registrationEmailWasAvailable = !users.users.some((user) => user.email === registrationEmail);
    }
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (userId) await admin.auth.admin.deleteUser(userId);
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const registrationUser = registrationEmail && registrationEmailWasAvailable
      ? data?.users.find((user) => user.email === registrationEmail)
      : undefined;
    if (registrationUser) await admin.auth.admin.deleteUser(registrationUser.id);
  });

  test("registers a new account through the public form", async ({ page }) => {
    test.skip(!registrationEmail, "Set LIVE_E2E_REGISTRATION_EMAIL to test real signup email delivery");
    test.skip(!registrationEmailWasAvailable, "Registration test email already belongs to an existing user");
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(registrationEmail!);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByLabel("确认密码").fill(password);
    await page.getByRole("button", { name: "注册" }).click();
    await expect(
      page.getByRole("status").or(page.getByRole("heading", { name: "设置个人资料" })),
    ).toBeVisible();
  });

  test("onboards, creates a plan, checks in, opens day details, and signs out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("用户名").fill(username);
    await page.getByLabel("昵称").fill("浏览器验收用户");
    await page.getByLabel("身高 cm（可选）").fill("170");
    await page.getByLabel("所在时区").fill("Asia/Shanghai");
    await page.getByRole("button", { name: "完成设置" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("你还没有安排运动计划")).toBeVisible();

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

    await page.getByRole("link", { name: "我的" }).click();
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

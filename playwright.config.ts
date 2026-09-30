import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const disableProxy = process.env.PLAYWRIGHT_DISABLE_PROXY === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        env: {
          NEXT_PUBLIC_CLOUDBASE_ENV_ID:
            process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID ?? "pwa-web-app-test",
          NEXT_PUBLIC_CLOUDBASE_REGION:
            process.env.NEXT_PUBLIC_CLOUDBASE_REGION ?? "ap-shanghai",
          NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY ?? "publishable-playwright-test",
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        },
      },
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    launchOptions: executablePath || disableProxy
      ? {
          executablePath,
          args: disableProxy ? ["--no-proxy-server"] : undefined,
        }
      : undefined,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 720 } } },
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 } } },
  ],
});

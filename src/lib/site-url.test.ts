import { describe, expect, it } from "vitest";

import { resolveSiteUrl } from "./site-url";

const base = {
  NEXT_PUBLIC_CLOUDBASE_ENV_ID: "pwa-web-app-test",
  NEXT_PUBLIC_CLOUDBASE_REGION: "ap-shanghai",
  NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: "publishable-test-value",
  NEXT_PUBLIC_SITE_URL: "https://workout.example.com",
};

describe("resolveSiteUrl", () => {
  it("uses the canonical production URL outside preview deployments", () => {
    expect(resolveSiteUrl({ ...base, VERCEL_ENV: "production" })).toBe(
      "https://workout.example.com",
    );
  });

  it("uses the current Vercel deployment URL for preview callbacks", () => {
    expect(
      resolveSiteUrl({
        ...base,
        VERCEL_ENV: "preview",
        VERCEL_URL: "preview.workout.example.com",
      }),
    ).toBe("https://preview.workout.example.com");
  });
});

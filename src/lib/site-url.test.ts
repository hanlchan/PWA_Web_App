import { describe, expect, it } from "vitest";

import { resolveSiteUrl } from "./site-url";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-value",
  NEXT_PUBLIC_SITE_URL: "https://pwa-web-app-phi.vercel.app",
};

describe("resolveSiteUrl", () => {
  it("uses the canonical production URL outside preview deployments", () => {
    expect(resolveSiteUrl({ ...base, VERCEL_ENV: "production" })).toBe(
      "https://pwa-web-app-phi.vercel.app",
    );
  });

  it("uses the current Vercel deployment URL for preview callbacks", () => {
    expect(
      resolveSiteUrl({
        ...base,
        VERCEL_ENV: "preview",
        VERCEL_URL: "pwa-web-app-feature-hanlchan.vercel.app",
      }),
    ).toBe("https://pwa-web-app-feature-hanlchan.vercel.app");
  });
});

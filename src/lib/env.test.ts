import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./env";

const validPublicEnv = {
  NEXT_PUBLIC_CLOUDBASE_ENV_ID: "pwa-web-app-test",
  NEXT_PUBLIC_CLOUDBASE_REGION: "ap-shanghai",
  NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: "publishable-test-value",
  NEXT_PUBLIC_SITE_URL: "https://workout.example.com",
};

describe("parsePublicEnv", () => {
  it("rejects missing CloudBase public values", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: validPublicEnv.NEXT_PUBLIC_SITE_URL })).toThrow();
  });

  it("rejects empty CloudBase environment values", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublicEnv,
        NEXT_PUBLIC_CLOUDBASE_ENV_ID: "",
        NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow();
  });

  it("returns exact valid public values", () => {
    expect(parsePublicEnv(validPublicEnv)).toEqual(validPublicEnv);
  });

  it("uses localhost as the site URL when it is omitted", () => {
    const withoutSiteUrl = {
      NEXT_PUBLIC_CLOUDBASE_ENV_ID: validPublicEnv.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
      NEXT_PUBLIC_CLOUDBASE_REGION: validPublicEnv.NEXT_PUBLIC_CLOUDBASE_REGION,
      NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: validPublicEnv.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    };

    expect(parsePublicEnv(withoutSiteUrl)).toEqual({
      ...withoutSiteUrl,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
  });

  it("reads runtime public values through direct process environment accesses", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/env.ts"), "utf8");

    expect(source).toContain("NEXT_PUBLIC_CLOUDBASE_ENV_ID: process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID");
    expect(source).toContain("NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY");
    expect(source).toContain("NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL");
  });
});

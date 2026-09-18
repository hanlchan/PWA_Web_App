import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./env";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(20),
  NEXT_PUBLIC_SITE_URL: "https://workout.example.com",
};

describe("parsePublicEnv", () => {
  it("rejects missing Supabase public values", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: validPublicEnv.NEXT_PUBLIC_SITE_URL })).toThrow();
  });

  it("rejects invalid Supabase URL and short anon key", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublicEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "too-short",
      }),
    ).toThrow();
  });

  it("returns exact valid public values", () => {
    expect(parsePublicEnv(validPublicEnv)).toEqual(validPublicEnv);
  });

  it("uses localhost as the site URL when it is omitted", () => {
    const withoutSiteUrl = {
      NEXT_PUBLIC_SUPABASE_URL: validPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: validPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    expect(parsePublicEnv(withoutSiteUrl)).toEqual({
      ...withoutSiteUrl,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
  });
});

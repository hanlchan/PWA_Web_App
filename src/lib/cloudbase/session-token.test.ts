import { describe, expect, it } from "vitest";

import { hasExpectedRlsClaims } from "./session-token";

const now = Date.parse("2026-09-29T00:00:00.000Z");

function token(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

describe("hasExpectedRlsClaims", () => {
  it("accepts a non-expired user token with the PG authenticated role", () => {
    expect(hasExpectedRlsClaims(token({ sub: "user-1", role: "authenticated", exp: now / 1000 + 3600 }), now)).toBe(true);
  });

  it("rejects a refreshed token missing the role even if the UID remains", () => {
    expect(hasExpectedRlsClaims(token({ sub: "user-1", exp: now / 1000 + 3600 }), now)).toBe(false);
  });

  it("rejects anonymous, expired, and malformed tokens", () => {
    expect(hasExpectedRlsClaims(token({ sub: "user-1", role: "anon", exp: now / 1000 + 3600 }), now)).toBe(false);
    expect(hasExpectedRlsClaims(token({ sub: "user-1", role: "authenticated", exp: now / 1000 + 30 }), now)).toBe(false);
    expect(hasExpectedRlsClaims("broken", now)).toBe(false);
  });
});

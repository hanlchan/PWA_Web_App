import { describe, expect, it } from "vitest";
import { pushSubscriptionSchema } from "./push";

describe("push subscription validation", () => {
  it("accepts a browser subscription and rejects malformed endpoints", () => {
    expect(pushSubscriptionSchema.parse({ endpoint: "https://push.example.test/subscription/123", p256dh: "a".repeat(32), auth: "b".repeat(16), userAgent: "test" }).endpoint).toContain("push.example");
    expect(() => pushSubscriptionSchema.parse({ endpoint: "javascript:x", p256dh: "short", auth: "bad", userAgent: "test" })).toThrow();
  });
});

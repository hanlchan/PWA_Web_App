import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema } from "./auth";

describe("auth validation", () => {
  it("normalizes email and accepts a strong password", () => {
    expect(loginSchema.parse({ email: " USER@Example.COM ", password: "password123" }).email).toBe("user@example.com");
  });
  it("rejects short passwords", () => expect(() => passwordSchema.parse("short")).toThrow());
});

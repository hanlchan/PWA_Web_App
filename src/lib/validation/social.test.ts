import { describe, expect, it } from "vitest";
import { socialIdSchema, userSearchSchema } from "./social";

describe("social validation", () => {
  it("trims valid searches and rejects broad one-character queries", () => {
    expect(userSearchSchema.parse(" han ")).toBe("han");
    expect(() => userSearchSchema.parse("h")).toThrow();
  });
  it("accepts only UUID object references", () => {
    expect(socialIdSchema.parse("10000000-0000-4000-8000-000000000001")).toContain("1000");
    expect(() => socialIdSchema.parse("someone-else")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile";

describe("profile validation", () => {
  it("normalizes a valid profile", () => {
    const value = profileSchema.parse({ username: " Han_Chan ", displayName: " 小韩 ", heightCm: "172.5", timezone: "Asia/Shanghai" });
    expect(value).toMatchObject({ username: "han_chan", displayName: "小韩", heightCm: 172.5 });
  });
  it.each(["_bad", "bad_", "ab", "含中文"])("rejects username %s", (username) => {
    expect(() => profileSchema.parse({ username, displayName: "韩", heightCm: "", timezone: "Asia/Shanghai" })).toThrow();
  });
  it("rejects invalid height and timezone", () => {
    expect(() => profileSchema.parse({ username: "valid_name", displayName: "韩", heightCm: "20", timezone: "Mars/Base" })).toThrow();
  });
});

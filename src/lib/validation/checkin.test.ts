import { describe, expect, it } from "vitest";

import { checkinDetailsSchema } from "./checkin";

describe("check-in details validation", () => {
  const base = {
    checkinId: "10000000-0000-4000-8000-000000000001",
    date: "2026-09-19",
    activityText: "  快走  ",
    notes: "",
  };

  it("normalizes optional details", () => {
    expect(checkinDetailsSchema.parse({ ...base, durationMinutes: "" })).toMatchObject({
      durationMinutes: null,
      activityText: "快走",
    });
  });

  it("rejects invalid identifiers and duration", () => {
    expect(() => checkinDetailsSchema.parse({ ...base, checkinId: "bad", durationMinutes: "30" })).toThrow();
    expect(() => checkinDetailsSchema.parse({ ...base, durationMinutes: "0" })).toThrow();
  });
});

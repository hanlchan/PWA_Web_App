import { describe, expect, it } from "vitest";

import { weightEntrySchema } from "./weight";

describe("weightEntrySchema", () => {
  it("accepts a private weight entry", () => {
    expect(weightEntrySchema.parse({ weightKg: "72.5", measuredAt: "2026-09-18T08:00", measurementType: "morning" }).weightKg).toBe(72.5);
  });

  it("rejects unsafe ranges and future timestamps", () => {
    expect(() => weightEntrySchema.parse({ weightKg: 10, measuredAt: "2026-09-18T08:00", measurementType: "custom" })).toThrow();
    expect(() => weightEntrySchema.parse({ weightKg: 70, measuredAt: "bad", measurementType: "custom" })).toThrow();
  });
});

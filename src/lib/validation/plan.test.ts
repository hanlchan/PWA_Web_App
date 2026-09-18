import { describe, expect, it } from "vitest";
import { planSchema } from "./plan";

const base = { title: " 20分钟跟跳 ", description: "", durationMinutes: 20, startDate: "2026-09-20", endDate: null, startTime: "20:30", reminderEnabled: true, notes: "" };

describe("planSchema", () => {
  it("normalizes a valid weekly plan", () => {
    const result = planSchema.parse({ ...base, recurrenceType: "weekly", daysOfWeek: [5, 1, 3, 3] });
    expect(result.title).toBe("20分钟跟跳");
    expect(result.recurrenceType === "weekly" && result.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("rejects empty weekly and out-of-range monthly selections", () => {
    expect(() => planSchema.parse({ ...base, recurrenceType: "weekly", daysOfWeek: [] })).toThrow();
    expect(() => planSchema.parse({ ...base, recurrenceType: "monthly", daysOfMonth: [0, 32] })).toThrow();
  });

  it("deduplicates and sorts custom dates", () => {
    const result = planSchema.parse({ ...base, recurrenceType: "custom_dates", customDates: ["2026-10-03", "2026-09-20", "2026-09-20"] });
    expect(result.recurrenceType === "custom_dates" && result.customDates).toEqual(["2026-09-20", "2026-10-03"]);
  });

  it("rejects an end date before the start date", () => {
    expect(() => planSchema.parse({ ...base, recurrenceType: "one_time", endDate: "2026-09-19" })).toThrow();
  });

  it("rejects video and URL fields", () => {
    expect(() => planSchema.parse({ ...base, recurrenceType: "one_time", url: "https://example.com" })).toThrow();
    expect(() => planSchema.parse({ ...base, recurrenceType: "one_time", externalUrl: "https://example.com" })).toThrow();
  });
});

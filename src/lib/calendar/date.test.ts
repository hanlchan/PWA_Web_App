import { describe, expect, it } from "vitest";

import { addCalendarDays, getDateInTimeZone, isInBackfillWindow, isValidIsoDate } from "./date";

describe("calendar dates", () => {
  it("validates real ISO calendar dates", () => {
    expect(isValidIsoDate("2026-09-19")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
  });

  it("uses the profile timezone when determining today", () => {
    const now = new Date("2026-09-18T16:30:00.000Z");
    expect(getDateInTimeZone(now, "Asia/Shanghai")).toBe("2026-09-19");
    expect(getDateInTimeZone(now, "America/Los_Angeles")).toBe("2026-09-18");
  });

  it("accepts today and the previous seven dates only", () => {
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isInBackfillWindow("2026-09-12", "2026-09-19")).toBe(true);
    expect(isInBackfillWindow("2026-09-11", "2026-09-19")).toBe(false);
    expect(isInBackfillWindow("2026-09-20", "2026-09-19")).toBe(false);
  });
});

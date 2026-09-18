import { describe, expect, it } from "vitest";
import { expandRecurrence } from "./expand";

describe("expandRecurrence", () => {
  it("expands ISO Monday Wednesday Friday within an inclusive window", () => {
    expect(expandRecurrence({ type: "weekly", startDate: "2026-09-01", daysOfWeek: [1, 3, 5] }, "2026-09-14", "2026-09-20"))
      .toEqual(["2026-09-14", "2026-09-16", "2026-09-18"]);
  });

  it("skips monthly dates that do not exist", () => {
    expect(expandRecurrence({ type: "monthly", startDate: "2026-02-01", daysOfMonth: [28, 31] }, "2026-02-01", "2026-03-31"))
      .toEqual(["2026-02-28", "2026-03-28", "2026-03-31"]);
  });

  it("includes leap day and respects an inclusive end date", () => {
    expect(expandRecurrence({ type: "monthly", startDate: "2028-01-01", endDate: "2028-02-29", daysOfMonth: [29] }, "2028-01-01", "2028-03-31"))
      .toEqual(["2028-01-29", "2028-02-29"]);
  });

  it("deduplicates, sorts, and clips custom dates", () => {
    expect(expandRecurrence({ type: "custom_dates", startDate: "2026-09-01", customDates: ["2026-10-03", "2026-09-20", "2026-09-20"] }, "2026-09-18", "2026-09-30"))
      .toEqual(["2026-09-20"]);
  });

  it("returns the one-time date only when it intersects the window", () => {
    expect(expandRecurrence({ type: "one_time", startDate: "2026-09-20" }, "2026-09-18", "2026-09-30"))
      .toEqual(["2026-09-20"]);
  });
});

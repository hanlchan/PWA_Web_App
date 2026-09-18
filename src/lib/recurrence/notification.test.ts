import { describe, expect, it } from "vitest";
import { toNotificationUtc } from "./notification";

describe("toNotificationUtc", () => {
  it("returns null when reminders are disabled", () => {
    expect(toNotificationUtc({ scheduledDate: "2026-09-18", scheduledTime: null, timezone: "Asia/Shanghai", reminderEnabled: false })).toBeNull();
  });

  it("uses local 20:00 when no time was selected", () => {
    expect(toNotificationUtc({ scheduledDate: "2026-09-18", scheduledTime: null, timezone: "Asia/Shanghai", reminderEnabled: true }))
      .toBe("2026-09-18T12:00:00.000Z");
  });

  it("uses an explicitly selected local time", () => {
    expect(toNotificationUtc({ scheduledDate: "2026-09-18", scheduledTime: "20:30", timezone: "Asia/Shanghai", reminderEnabled: true }))
      .toBe("2026-09-18T12:30:00.000Z");
  });

  it("rejects a DST-skipped wall time", () => {
    expect(() => toNotificationUtc({ scheduledDate: "2026-03-08", scheduledTime: "02:30", timezone: "America/New_York", reminderEnabled: true }))
      .toThrow("本地时间不存在");
  });
});

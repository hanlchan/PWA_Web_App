import { describe, expect, it } from "vitest";

import { MAX_PHOTO_BYTES, progressPhotoRecordSchema, validatePhotoFile } from "./photo";

describe("progress photo validation", () => {
  it("accepts an owned, private photo record", () => {
    const value = progressPhotoRecordSchema.parse({
      storagePath: "80000000-0000-4000-8000-000000000001/81000000-0000-4000-8000-000000000001.webp",
      photoDate: "2026-09-19",
      note: "  第一个月  ",
      visibility: "private",
    });
    expect(value.note).toBe("第一个月");
  });

  it("rejects paths outside the user folder and long notes", () => {
    expect(() => progressPhotoRecordSchema.parse({ storagePath: "../secret.webp", photoDate: "2026-09-19", note: "", visibility: "private" })).toThrow();
    expect(() => progressPhotoRecordSchema.parse({ storagePath: "80000000-0000-4000-8000-000000000001/x.webp", photoDate: "2026-09-19", note: "x".repeat(501), visibility: "private" })).toThrow();
  });

  it("rejects unsupported and oversized source files", () => {
    expect(validatePhotoFile({ type: "image/gif", size: 100 })).toMatch(/JPEG/);
    expect(validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toMatch(/10 MB/);
    expect(validatePhotoFile({ type: "image/png", size: 100 })).toBeNull();
  });
});

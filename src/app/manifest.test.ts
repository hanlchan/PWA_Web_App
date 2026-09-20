import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("PWA manifest", () => {
  it("declares a standalone Chinese application and install icons", () => {
    const value = manifest();
    expect(value.name).toBe("运动打卡");
    expect(value.short_name).toBe("运动打卡");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#10b981");
    expect(value.background_color).toBe("#f0fdf4");
    expect(value.icons).toHaveLength(3);
  });
});

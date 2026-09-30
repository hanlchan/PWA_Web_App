import { describe, expect, it } from "vitest";

import { syncSessionAction } from "./auth";

describe("syncSessionAction", () => {
  it("rejects incomplete browser sessions before writing cookies", async () => {
    await expect(syncSessionAction({ accessToken: "", refreshToken: "", expiresIn: Number.NaN })).resolves.toEqual({
      ok: false,
      message: "CloudBase 会话不完整",
    });
  });
});

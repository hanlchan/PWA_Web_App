import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./proxy";

const mock = vi.hoisted(() => ({ init: vi.fn(), refreshSession: vi.fn() }));

vi.mock("@cloudbase/js-sdk", () => ({ default: { init: mock.init } }));
vi.mock("../env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: "test-env",
    NEXT_PUBLIC_CLOUDBASE_REGION: "ap-shanghai",
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
}));

function authenticatedToken() {
  const claims = { sub: "test-user", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 };
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

describe("CloudBase proxy session refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.init.mockReturnValue({ auth: { refreshSession: mock.refreshSession } });
  });

  it("clears cookies and redirects to login when the SDK refresh throws", async () => {
    mock.refreshSession.mockRejectedValue(new Error("temporary CloudBase failure"));
    const request = new NextRequest("https://example.com/plans/new", {
      headers: { cookie: [
        `cloudbase_access_token=${authenticatedToken()}`,
        "cloudbase_refresh_token=test-refresh-token",
        `cloudbase_expires_at=${Date.now() + 10_000}`,
      ].join("; ") },
    });

    const response = await updateSession(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login");
    expect(response.cookies.get("cloudbase_access_token")?.value).toBe("");
    expect(response.cookies.get("cloudbase_refresh_token")?.value).toBe("");
  });
});

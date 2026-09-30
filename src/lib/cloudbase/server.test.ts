import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, createStorageClient } from "./server";

const mock = vi.hoisted(() => ({
  init: vi.fn(),
  setSession: vi.fn(),
  cookieValues: new Map<string, string>(),
}));

vi.mock("@cloudbase/js-sdk", () => ({ default: { init: mock.init } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => {
    const value = mock.cookieValues.get(name);
    return value ? { value } : undefined;
  } }),
}));
vi.mock("../env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: "test-env",
    NEXT_PUBLIC_CLOUDBASE_REGION: "ap-shanghai",
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
}));

describe("CloudBase server clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.cookieValues.clear();
    mock.cookieValues.set("cloudbase_access_token", "test-access-token");
    mock.cookieValues.set("cloudbase_refresh_token", "test-refresh-token");
    mock.setSession.mockResolvedValue({ error: null });
    mock.init.mockReturnValue({ auth: { setSession: mock.setSession }, storage: { from: vi.fn() } });
  });

  it("does not initialize Storage auth while creating a database client", async () => {
    const client = await createClient();
    expect(mock.init).not.toHaveBeenCalled();

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '"plan-id"' });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(client.rpc("create_workout_plan", { p_payload: {} })).resolves.toEqual({
        data: "plan-id",
        error: null,
      });
      expect(mock.init).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://test-env.api.tcloudbasegateway.com/v1/rdb/rest/rpc/create_workout_plan",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("initializes the SDK session only when Storage is used", async () => {
    const storage = await createStorageClient();
    expect(storage).toBeDefined();
    expect(mock.init).toHaveBeenCalledOnce();
    expect(mock.setSession).toHaveBeenCalledWith({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
    });
  });

  it("keeps Storage session failures out of database-only requests", async () => {
    mock.setSession.mockResolvedValue({ error: { message: "Storage session unavailable" } });
    await expect(createClient()).resolves.toHaveProperty("rpc");
    await expect(createStorageClient()).rejects.toThrow("Storage session unavailable");
  });
});

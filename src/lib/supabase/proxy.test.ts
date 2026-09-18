import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  setAll: undefined as undefined | ((cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("../env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(20),
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  }),
}));

import { updateSession } from "./proxy";

const requestFor = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

describe("updateSession", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.createServerClient.mockReset();
    mocks.createServerClient.mockImplementation(
      (_url, _key, options: { cookies: { setAll: typeof mocks.setAll } }) => {
        mocks.setAll = options.cookies.setAll;
        return { auth: { getUser: mocks.getUser } };
      },
    );
  });

  it("redirects an anonymous visitor from a protected route to login", async () => {
    const response = await updateSession(requestFor("/plans/today"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("continues an authenticated visitor to a protected route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await updateSession(requestFor("/stats/week"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("propagates every refreshed cookie and its options on an authenticated continuing response", async () => {
    mocks.getUser.mockImplementation(async () => {
      mocks.setAll?.([
        {
          name: "sb-access-token",
          value: "new-access-token",
          options: { httpOnly: true, path: "/", sameSite: "lax" },
        },
        {
          name: "sb-refresh-token",
          value: "new-refresh-token",
          options: { httpOnly: true, path: "/", sameSite: "strict", secure: true },
        },
      ]);
      return { data: { user: { id: "user-1" } }, error: null };
    });

    const response = await updateSession(requestFor("/settings/profile"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("sb-access-token")).toMatchObject({
      value: "new-access-token",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    expect(response.cookies.get("sb-refresh-token")).toMatchObject({
      value: "new-refresh-token",
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
  });

  it("keeps auth pages accessible to anonymous visitors", async () => {
    const response = await updateSession(requestFor("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("protects onboarding for anonymous visitors", async () => {
    const response = await updateSession(requestFor("/onboarding"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("propagates refreshed Supabase cookies to redirect responses", async () => {
    mocks.getUser.mockImplementation(async () => {
      mocks.setAll?.([{ name: "sb-access-token", value: "refreshed", options: { httpOnly: true } }]);
      return { data: { user: null }, error: null };
    });

    const response = await updateSession(requestFor("/settings/profile"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed");
  });
});

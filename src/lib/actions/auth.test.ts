import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, signUp } = vi.hoisted(() => ({
  redirect: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signUp } })),
}));

import { registerAction } from "./auth";

function registrationData() {
  const data = new FormData();
  data.set("email", "friend@example.com");
  data.set("password", "Password9!");
  data.set("confirmPassword", "Password9!");
  return data;
}

describe("registerAction", () => {
  beforeEach(() => {
    redirect.mockReset();
    signUp.mockReset();
  });

  it("returns a success state when email confirmation is required", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(registerAction({ ok: false, message: "" }, registrationData())).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects authenticated registrations to onboarding", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });

    await registerAction({ ok: false, message: "" }, registrationData());

    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
});

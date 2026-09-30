import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/cloudbase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/auth", () => ({ syncSessionAction: vi.fn() }));

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  it("renders the CloudBase email verification registration flow", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送注册验证码" })).toBeInTheDocument();
  });
});

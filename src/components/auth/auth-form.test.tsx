import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  it("shows the email confirmation message when registration has no session", async () => {
    const user = userEvent.setup();
    render(
      <AuthForm
        mode="register"
        action={async () => ({ ok: true, data: undefined })}
      />,
    );

    await user.type(screen.getByLabelText("邮箱"), "friend@example.com");
    await user.type(screen.getByLabelText("密码", { selector: "input" }), "Password9!");
    await user.type(screen.getByLabelText("确认密码"), "Password9!");
    await user.click(screen.getByRole("button", { name: "注册" }));

    expect(await screen.findByRole("status")).toHaveTextContent("注册成功，请检查邮箱完成验证。");
  });
});

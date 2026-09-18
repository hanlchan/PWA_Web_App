import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "./page";

describe("dashboard empty state", () => {
  it("shows no default plan and offers user-created planning", () => {
    render(<DashboardPage />);
    expect(screen.getByText("你还没有安排运动计划")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一个计划" })).toHaveAttribute("href", "/plans/new");
    expect(screen.queryByText("打开视频")).not.toBeInTheDocument();
  });
});

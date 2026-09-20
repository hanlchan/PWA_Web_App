import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

const getTodayDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries/dashboard", () => ({ getTodayDashboard }));

describe("dashboard empty state", () => {
  beforeEach(() => {
    getTodayDashboard.mockResolvedValue({
      today: "2026-09-18",
      has_active_plans: false,
      today_occurrences: [],
      today_checkins: [],
      total_checkin_days: 0,
      current_streak: 0,
      unread_notifications: 0,
    });
  });

  it("shows no default plan and offers user-created planning", async () => {
    render(await DashboardPage());
    expect(screen.getByText("你还没有安排运动计划")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一个计划" })).toHaveAttribute("href", "/plans/new");
    expect(screen.queryByText("打开视频")).not.toBeInTheDocument();
  });

  it("distinguishes an existing plan from an empty schedule today", async () => {
    getTodayDashboard.mockResolvedValue({
      today: "2026-09-18",
      has_active_plans: true,
      today_occurrences: [],
      today_checkins: [],
      total_checkin_days: 0,
      current_streak: 0,
      unread_notifications: 0,
    });

    render(await DashboardPage());
    expect(screen.getByText("今天没有安排打卡")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看我的计划" })).toHaveAttribute("href", "/plans");
    expect(screen.queryByText("你还没有安排运动计划")).not.toBeInTheDocument();
  });
});

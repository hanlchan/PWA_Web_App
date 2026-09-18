import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("@/lib/queries/dashboard",()=>({getTodayDashboard:vi.fn(async()=>({today:"2026-09-18",today_occurrences:[],today_checkins:[],total_checkin_days:0,current_streak:0,unread_notifications:0}))}));

describe("dashboard empty state", () => {
  it("shows no default plan and offers user-created planning", async () => {
    render(await DashboardPage());
    expect(screen.getByText("你还没有安排运动计划")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一个计划" })).toHaveAttribute("href", "/plans/new");
    expect(screen.queryByText("打开视频")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthCalendar } from "./month-calendar";

describe("MonthCalendar", () => {
  it("links private calendar days to their detail pages", () => {
    render(<MonthCalendar month="2026-09" entries={[]} detailsBasePath="/stats" />);
    expect(screen.getByRole("link", { name: "查看 2026-09-19 记录" })).toHaveAttribute("href", "/stats/2026-09-19");
  });

  it("keeps public profile calendar days non-navigable", () => {
    render(<MonthCalendar month="2026-09" entries={[{ scheduled_date: "2026-09-19", state: "manual_completed" }]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByLabelText("2026-09-19 manual_completed")).toBeInTheDocument();
  });
});

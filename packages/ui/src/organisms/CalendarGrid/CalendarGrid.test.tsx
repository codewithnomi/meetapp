// CalendarGrid tests (AC-F13-01, 02): meetings are placed and open, "+N more" reports its meetings, and the
// now-line sits in today's column only and moves with the clock.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarGrid, HOUR_PX, type CalendarGridProps, type GridDay } from "./CalendarGrid.tsx";

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const meeting = (id: string, start: number, end: number) => ({
  id,
  title: `Meeting ${id}`,
  time: "10:00 – 10:30",
  state: "accepted" as const,
  stateLabel: "Accepted",
  start,
  end,
});
const day = (key: string, today: boolean, meetings: GridDay["meetings"] = []): GridDay => ({
  key,
  label: key,
  fullLabel: `Day ${key}`,
  today,
  allDay: [],
  meetings,
});

function props(overrides: Partial<CalendarGridProps> = {}): CalendarGridProps {
  return {
    days: [day("Tue", false), day("Wed", true, [meeting("a", 600, 630)])],
    hourLabels: hours,
    allDayLabel: "All day",
    moreLabel: (n) => `+${String(n)} more`,
    onOpen: vi.fn(),
    onMore: vi.fn(),
    ...overrides,
  };
}

describe("CalendarGrid", () => {
  it("TC-F13-21 [AC-F13-02] the now-line sits in today's column only, at the time, and moves", () => {
    const { rerender } = render(<CalendarGrid {...props({ nowMinute: 10 * 60 + 20 })} />);
    const lines = screen.getAllByTestId("now-line");
    expect(lines).toHaveLength(1);
    expect(within(screen.getByRole("group", { name: "Day Wed" })).getByTestId("now-line")).toBe(lines[0]);
    expect(parseFloat(lines[0]?.style.top ?? "")).toBeCloseTo((620 / 60) * HOUR_PX);
    rerender(<CalendarGrid {...props({ nowMinute: 10 * 60 + 21 })} />);
    expect(parseFloat(screen.getByTestId("now-line").style.top)).toBeCloseTo((621 / 60) * HOUR_PX);
  });

  it("TC-F13-16 [AC-F13-01] a meeting opens; six at once show four and '+2 more'", async () => {
    const onOpen = vi.fn();
    const onMore = vi.fn();
    const six = Array.from({ length: 6 }, (_, i) => meeting(String(i), 600, 660));
    render(<CalendarGrid {...props({ days: [day("Wed", true, six)], onOpen, onMore })} />);
    expect(screen.getAllByRole("button", { name: /^Meeting \d/ })).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "Meeting 0, 10:00 – 10:30, Accepted" }));
    expect(onOpen).toHaveBeenCalledWith("0");
    await userEvent.click(screen.getByRole("button", { name: "+2 more" }));
    expect(onMore).toHaveBeenCalledWith(["4", "5"]);
  });

  it("TC-F13-26 [AC-F13-07] dragging over empty time picks that range in half hours; a block doesn't start one", () => {
    const onPickTime = vi.fn();
    render(<CalendarGrid {...props({ onPickTime })} />);
    const column = screen.getByRole("group", { name: "Day Tue" });
    fireEvent.pointerDown(column, { clientY: 14 * HOUR_PX + 5 });
    fireEvent.pointerUp(column, { clientY: 15 * HOUR_PX + 5 });
    expect(onPickTime).toHaveBeenCalledWith("Tue", 14 * 60, 15 * 60 + 30);
    fireEvent.pointerDown(screen.getByRole("button", { name: /^Meeting a/ }), { clientY: 10 * HOUR_PX });
    fireEvent.pointerUp(screen.getByRole("group", { name: "Day Wed" }), { clientY: 10 * HOUR_PX });
    expect(onPickTime).toHaveBeenCalledTimes(1);
  });
});

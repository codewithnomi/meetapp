// CalendarMonth tests (AC-F13-01): up to 3 meetings a day, "+N more" reports the rest, days of other months
// are dimmed, and every meeting opens with the keyboard.
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarMonth, type MonthDay } from "./CalendarMonth.tsx";

const meeting = (id: string) => ({
  id,
  title: `Meeting ${id}`,
  time: "10:00",
  state: "accepted" as const,
  stateLabel: "Accepted",
  start: 600,
  end: 630,
});
const day = (key: string, ids: string[], extra: Partial<MonthDay> = {}): MonthDay => ({
  key,
  label: key,
  fullLabel: `Day ${key}`,
  dayNumber: key,
  allDay: [],
  meetings: ids.map(meeting),
  ...extra,
});

function show(days: MonthDay[]) {
  const onOpen = vi.fn();
  const onMore = vi.fn();
  render(<CalendarMonth days={days} moreLabel={(n) => `+${String(n)} more`} onOpen={onOpen} onMore={onMore} />);
  return { onOpen, onMore };
}

describe("CalendarMonth", () => {
  it("TC-F13-17 [AC-F13-01] shows 3 meetings and '+2 more' for the rest", async () => {
    const { onMore } = show([day("5", ["a", "b", "c", "d", "e"])]);
    const cell = screen.getByRole("listitem", { name: "Day 5" });
    expect(within(cell).getAllByRole("button", { name: /^Meeting/ })).toHaveLength(3);
    await userEvent.click(within(cell).getByRole("button", { name: "+2 more" }));
    expect(onMore).toHaveBeenCalledWith(["d", "e"]);
  });

  it("TC-F13-17 [AC-F13-01] a meeting opens with Enter; other months are dimmed", async () => {
    const { onOpen } = show([day("30", [], { outside: true }), day("1", ["a"])]);
    expect(screen.getByText("30")).toHaveClass("text-ink-subtle");
    screen.getByRole("button", { name: /^Meeting a/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});

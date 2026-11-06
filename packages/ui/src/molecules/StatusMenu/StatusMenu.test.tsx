// StatusMenu tests (TC-F04-37, AC-F04-20, 21): the picture menu lists every status, the durations and
// Reset; it works with the keyboard and names everything for screen readers.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusMenu, type StatusMenuProps } from "./StatusMenu.tsx";

const props = (more: Partial<StatusMenuProps> = {}): StatusMenuProps => ({
  name: "Olivia Owner",
  email: "owner@example.test",
  status: "available",
  chosen: null,
  duration: "forever",
  until: null,
  statusLabels: {
    available: "Available",
    busy: "Busy",
    dnd: "Do not disturb",
    brb: "Be right back",
    away: "Appear away",
    in_call: "In a call",
    offline: "Offline",
  },
  durationLabels: {
    "30m": "30 minutes",
    "1h": "1 hour",
    "2h": "2 hours",
    today: "Today",
    week: "This week",
    forever: "Until I change it",
  },
  words: { menu: "Your account", forHowLong: "For how long", reset: "Reset status" },
  actions: [{ id: "settings", label: "Settings", onSelect: vi.fn() }],
  onChoose: vi.fn(),
  onReset: vi.fn(),
  ...more,
});

async function openStatus() {
  screen.getByRole("button", { name: /^Your account: Olivia Owner/ }).focus();
  await userEvent.keyboard("{Enter}");
  // The status line opens its sub-menu with the right arrow, as in any menu.
  screen.getByRole("menuitem", { name: /Available|Busy|Do not disturb/ }).focus();
  await userEvent.keyboard("{ArrowRight}");
}

describe("StatusMenu", () => {
  it("TC-F04-37 [AC-F04-20, AC-F04-21] lists the statuses, for how long, and Reset status", async () => {
    render(<StatusMenu {...props()} />);
    await openStatus();
    const radios = screen.getAllByRole("menuitemradio").map((item) => item.textContent);
    expect(radios).toEqual([
      "Available",
      "Busy",
      "Do not disturb",
      "Be right back",
      "Appear away",
      "30 minutes",
      "1 hour",
      "2 hours",
      "Today",
      "This week",
      "Until I change it",
    ]);
    expect(screen.getByRole("menuitem", { name: "Reset status" })).toBeInTheDocument();
    // The sub-menu is named by the status line that opens it (Radix).
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("TC-F04-37 [AC-F04-20, AC-F04-21] picking a status keeps the duration; a duration keeps the status; Reset", async () => {
    const onChoose = vi.fn();
    const onReset = vi.fn();
    render(<StatusMenu {...props({ onChoose, onReset, chosen: "busy", duration: "1h" })} />);
    await openStatus();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Do not disturb" }));
    expect(onChoose).toHaveBeenLastCalledWith("dnd", "1h");
    await openStatus();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Today" }));
    expect(onChoose).toHaveBeenLastCalledWith("busy", "today");
    await openStatus();
    await userEvent.click(screen.getByRole("menuitem", { name: "Reset status" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-37 [AC-F04-21] shows when a status ends", async () => {
    render(<StatusMenu {...props({ status: "dnd", chosen: "dnd", until: "Until 11:30" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Your account: Olivia Owner, Do not disturb" }));
    expect(screen.getByText("Until 11:30")).toBeInTheDocument();
  });
});

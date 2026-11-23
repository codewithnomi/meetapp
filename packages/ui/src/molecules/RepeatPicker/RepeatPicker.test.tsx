// RepeatPicker tests (AC-F13-10, 11): the choice, weekly day buttons and the end date report together.
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepeatPicker, type RepeatPickerProps } from "./RepeatPicker.tsx";

type Kind = "none" | "weekly" | "daily";
function props(overrides: Partial<RepeatPickerProps<Kind, "MO" | "WE">> = {}): RepeatPickerProps<Kind, "MO" | "WE"> {
  return {
    id: "repeat",
    label: "Repeat",
    choices: [
      { value: "none", label: "Does not repeat" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
    ],
    kind: "weekly",
    noneKind: "none",
    weeklyKind: "weekly",
    days: {
      label: "Repeat on",
      days: [
        { value: "MO", short: "M", full: "Monday" },
        { value: "WE", short: "W", full: "Wednesday" },
      ],
      chosen: ["WE"],
    },
    until: { label: "End repeat", value: "" },
    onChange: vi.fn(),
    ...overrides,
  };
}

describe("RepeatPicker", () => {
  it("TC-F13-29 [AC-F13-10] weekly shows pressed day buttons; a click adds the day", async () => {
    const p = props();
    render(<RepeatPicker {...p} />);
    expect(screen.getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Monday" }));
    expect(p.onChange).toHaveBeenCalledWith({ kind: "weekly", days: ["WE", "MO"], until: "" });
  });

  it("TC-F13-29 [AC-F13-10] choosing another kind and an end date report; no days or end when it doesn't repeat", () => {
    const p = props({ kind: "daily" });
    const { rerender } = render(<RepeatPicker {...p} />);
    expect(screen.queryByRole("group", { name: "Repeat on" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("End repeat"), { target: { value: "2026-12-30" } });
    expect(p.onChange).toHaveBeenCalledWith({ kind: "daily", days: ["WE"], until: "2026-12-30" });
    fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "none" } });
    expect(p.onChange).toHaveBeenLastCalledWith({ kind: "none", days: ["WE"], until: "" });
    rerender(<RepeatPicker {...p} kind="none" />);
    expect(screen.queryByLabelText("End repeat")).not.toBeInTheDocument();
  });
});

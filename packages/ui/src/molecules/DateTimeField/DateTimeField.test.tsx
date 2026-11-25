// DateTimeField tests (AC-F13-07): date and time change separately; all day hides the time.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimeField } from "./DateTimeField.tsx";

describe("DateTimeField", () => {
  it("TC-F13-26 [AC-F13-07] reports the new date or time; all day hides the time", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateTimeField id="s" label="Starts" timeLabel="Start time" date="2026-11-25" time="10:00" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-11-26" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "11:30" } });
    expect(onChange.mock.calls).toEqual([
      [{ date: "2026-11-26", time: "10:00" }],
      [{ date: "2026-11-25", time: "11:30" }],
    ]);
    rerender(
      <DateTimeField
        id="s"
        label="Starts"
        timeLabel="Start time"
        date="2026-11-25"
        time="10:00"
        allDay
        onChange={onChange}
      />,
    );
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });

  it("TC-F13-29 [AC-F13-10] the error is read out for the time box too", () => {
    render(
      <DateTimeField
        id="e"
        label="Ends"
        timeLabel="End time"
        date="2026-11-25"
        time="09:00"
        error="Ends before it starts"
        onChange={vi.fn()}
      />,
    );
    const box = screen.getByLabelText("End time");
    expect(box).toHaveAccessibleDescription("Ends before it starts");
  });
});

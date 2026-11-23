// ScheduleForm tests (AC-F13-07, 31): Send submits once and waits while busy; errors are read out; the
// fields report their changes.
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScheduleForm, type ScheduleFormProps } from "./ScheduleForm.tsx";

function props(overrides: Partial<ScheduleFormProps> = {}): ScheduleFormProps {
  return {
    heading: "New meeting",
    cancel: { label: "Cancel", onClick: vi.fn() },
    submit: { label: "Send", busyLabel: "Sending…", onSubmit: vi.fn() },
    title: { label: "Title", value: "Planning", onChange: vi.fn() },
    people: <span>people</span>,
    starts: <span>starts</span>,
    ends: <span>ends</span>,
    allDay: { label: "All day", checked: false, onChange: vi.fn() },
    timeZoneNote: "Time zone: London (GMT)",
    repeat: <span>repeat</span>,
    notes: { label: "Notes", value: "", onChange: vi.fn() },
    footnote: "Everyone gets an email with a calendar file.",
    ...overrides,
  };
}

describe("ScheduleForm", () => {
  it("TC-F13-26 [AC-F13-07] Send submits; Enter in the title submits; fields report changes", async () => {
    const p = props();
    render(<ScheduleForm {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    screen.getByLabelText("Title").focus();
    await userEvent.keyboard("{Enter}");
    expect(p.submit.onSubmit).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Agenda" } });
    expect(p.notes.onChange).toHaveBeenCalledWith("Agenda");
    await userEvent.click(screen.getByRole("switch", { name: "All day" }));
    expect(p.allDay.onChange).toHaveBeenCalledWith(true);
  });

  it("TC-F13-39 [AC-F13-31] while busy Send waits; field and form errors are read out", async () => {
    const p = props({
      submit: { label: "Send", busyLabel: "Sending…", busy: true, onSubmit: vi.fn() },
      title: { label: "Title", value: "", error: "Give the meeting a title.", onChange: vi.fn() },
      error: "You've sent a lot of invites. Try again in 12 minutes.",
    });
    render(<ScheduleForm {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Sending…" }));
    expect(p.submit.onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "You've sent a lot of invites. Try again in 12 minutes.",
      "Give the meeting a title.",
    ]);
  });
});

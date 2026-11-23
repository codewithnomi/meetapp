// ReminderCard tests (AC-F13-21): Join, Snooze, Dismiss and opening the details all report.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReminderCard } from "./ReminderCard.tsx";

const action = (label: string) => ({ label, onClick: vi.fn() });

describe("ReminderCard", () => {
  it("TC-F13-36 [AC-F13-21] shows the heading, title and time; each button reports", async () => {
    const props = {
      heading: "Starts in 15 min",
      title: "Planning",
      time: "10:00 – 10:30",
      open: action("Open Planning"),
      join: action("Join"),
      snooze: action("Snooze 5 min"),
      dismiss: action("Dismiss"),
    };
    render(<ReminderCard {...props} />);
    expect(screen.getByRole("region", { name: "Starts in 15 min: Planning" })).toBeInTheDocument();
    for (const name of ["Open Planning", "Join", "Snooze 5 min", "Dismiss"]) {
      await userEvent.click(screen.getByRole("button", { name }));
    }
    for (const a of [props.open, props.join, props.snooze, props.dismiss]) expect(a.onClick).toHaveBeenCalledTimes(1);
  });

  it("TC-F13-36 [AC-F13-21] no Join when the meeting can't be joined yet", () => {
    render(
      <ReminderCard heading="h" title="t" time="x" open={action("o")} snooze={action("s")} dismiss={action("d")} />,
    );
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });
});

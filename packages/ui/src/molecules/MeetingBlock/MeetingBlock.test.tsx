// MeetingBlock tests (AC-F13-06, 24): each answer has its own look, a declined meeting stays visible, a
// series shows the repeat icon, and the spoken name reads title, time and answer.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingBlock, type MeetingBlockState } from "./MeetingBlock.tsx";

const LABELS: Record<MeetingBlockState, string> = {
  accepted: "Accepted",
  none: "No answer",
  tentative: "Maybe",
  declined: "Declined",
  cancelled: "Cancelled",
};

describe("MeetingBlock", () => {
  it("TC-F13-23 [AC-F13-06] [AC-F13-24] every answer renders, with its own look and spoken name", () => {
    for (const state of Object.keys(LABELS) as MeetingBlockState[]) {
      const { unmount } = render(
        <MeetingBlock
          title="Planning"
          time="10:00 – 10:30"
          state={state}
          stateLabel={LABELS[state]}
          onOpen={vi.fn()}
        />,
      );
      const block = screen.getByRole("button", { name: `Planning, 10:00 – 10:30, ${LABELS[state]}` });
      expect(block).toHaveAttribute("data-state", state);
      unmount();
    }
  });

  it("TC-F13-23 [AC-F13-06] Declined is struck through but present; Maybe is striped", () => {
    render(<MeetingBlock title="A" time="9:00" state="declined" stateLabel="Declined" onOpen={vi.fn()} />);
    render(<MeetingBlock title="B" time="9:00" state="tentative" stateLabel="Maybe" onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^A,/ })).toHaveClass("line-through");
    expect(screen.getByRole("button", { name: /^B,/ }).className).toContain("repeating-linear-gradient");
  });

  it("TC-F13-23 [AC-F13-06] a series shows the repeat icon; Enter opens it", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <MeetingBlock title="Weekly" time="9:00" state="accepted" stateLabel="Accepted" repeats onOpen={onOpen} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

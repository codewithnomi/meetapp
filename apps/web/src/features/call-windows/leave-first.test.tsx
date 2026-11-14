// "Leave first" (F17 TC-F17-23, AC-F17-09, 12): without a call the new thing runs at once; during one it
// asks. Cancel changes nothing; Leave runs the call screen's Leave and, once the call is over, the new
// thing; if leaving doesn't finish within 5 s it says so and the new thing never runs.
import { act, render, renderHook, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCallCorner } from "../call-corner/index.ts";
import { inCallNow } from "../calls/index.ts";
import { useVisit, type Joined } from "../meetings/index.ts";
import { useCallScreen } from "./call-screen.ts";
import { LeaveFirstDialog, useLeaveFirst } from "./leave-first.tsx";

const visit: Joined = {
  attendanceId: "00000000-0000-4000-8000-000000000001",
  status: "admitted",
  title: "Release team",
  group: "member",
  ticket: "t",
};

let leave = vi.fn();

function inCall() {
  useVisit.getState().start(visit);
  useCallScreen.getState().publish(
    {
      title: "Release team",
      joinedAt: Date.now(),
      people: 2,
      phase: "in-call",
      speaker: { name: "Sara Malik", initials: "SM", hasVideo: false, sharing: false },
      mic: true,
      camera: false,
      hand: false,
      canUnmute: true,
      canShare: true,
    },
    { toggleMic: vi.fn(), toggleCamera: vi.fn(), share: vi.fn(), toggleHand: vi.fn(), leave },
  );
}

function ask(kind: "start" | "join", then: () => void) {
  const { result } = renderHook(() => useLeaveFirst());
  act(() => result.current(kind, then));
}

beforeEach(() => {
  leave = vi.fn();
  // As the call host registers it, from the calls' own stores.
  useCallCorner.getState().register({ inCall: inCallNow, leave: () => useCallScreen.getState().controls?.leave() });
});
afterEach(() => {
  useVisit.getState().end();
  useCallScreen.getState().clear();
  vi.useRealTimers();
});

describe("leave first", () => {
  it("TC-F17-23 [AC-F17-09] without a call the new thing runs at once, no question", () => {
    const then = vi.fn();
    render(<LeaveFirstDialog />);
    ask("start", then);
    expect(then).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("TC-F17-23 [AC-F17-09] during a call it asks; Cancel changes nothing", async () => {
    inCall();
    const then = vi.fn();
    render(<LeaveFirstDialog />);
    ask("start", then);
    expect(screen.getByRole("dialog", { name: "Start something new?" })).toHaveTextContent(
      "You're in Release team. Starting this leaves it.",
    );
    // The Cancel button (the dialog's × has the same name and does the same).
    const cancel = screen.getAllByRole("button", { name: "Cancel" }).at(-1);
    await userEvent.click(cancel as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(leave).not.toHaveBeenCalled();
    expect(then).not.toHaveBeenCalled();
  });

  it("TC-F17-23 [AC-F17-09, 12] Leave call and join leaves first, then joins once the call is over", async () => {
    inCall();
    leave.mockImplementation(() => setTimeout(() => useVisit.getState().end(), 150));
    const then = vi.fn();
    render(<LeaveFirstDialog />);
    ask("join", then);
    await userEvent.click(screen.getByRole("button", { name: "Leave call and join" }));
    expect(leave).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Leave call and join" })).toBeDisabled();
    expect(then).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(then).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("TC-F17-23 [AC-F17-09] leaving that doesn't finish within 5 s says so; the new thing never runs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    inCall();
    const then = vi.fn();
    render(<LeaveFirstDialog />);
    ask("start", then);
    await userEvent.click(screen.getByRole("button", { name: "Leave call and start" }));
    await act(() => vi.advanceTimersByTimeAsync(5_200));
    expect(screen.getByText("Couldn't leave the call. Try again.")).toBeInTheDocument();
    expect(then).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Leave call and start" })).toBeEnabled();
  });
});

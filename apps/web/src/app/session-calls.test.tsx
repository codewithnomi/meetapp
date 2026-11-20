// A call belongs to the person signed in (F17 security review; TC-F17-47b, AC-F17-16): when the person
// changes or signs out any way, the call is left and every trace of it is cleared before any screen shows.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallScreen } from "../features/call-windows/index.ts";
import { useCallOutcome, useChatCall } from "../features/calls/index.ts";
import { useVisit, type Joined } from "../features/meetings/index.ts";
import { useCallsFollowSession } from "./session-calls.ts";

const left = vi.hoisted(() => vi.fn());
vi.mock("../features/meetings/index.ts", async (original) => ({
  ...(await original<typeof import("../features/meetings/index.ts")>()),
  leaveMeeting: left,
}));

const visit: Joined = {
  attendanceId: "00000000-0000-4000-8000-000000000001",
  status: "admitted",
  title: "Design review",
  group: "member",
  ticket: "secret-ticket",
};

afterEach(() => left.mockClear());

describe("calls follow who is signed in", () => {
  it("TC-F17-47b [AC-F17-16] signing out any way leaves the call and clears it; the same person keeps it", () => {
    useVisit.getState().start(visit, "address");
    useChatCall.setState({
      call: { callId: "c", conversationId: "v", media: "audio", title: "Omar", oneToOne: true, phase: "in_call" },
    });
    useCallOutcome.getState().set({ ...visit, status: "left" });
    const { result, rerender } = renderHook(({ id }) => useCallsFollowSession(id), {
      initialProps: { id: "user-a" as string | undefined },
    });
    expect(result.current).toBe(true);
    rerender({ id: "user-a" });
    expect(useVisit.getState().visit).toBeDefined();
    act(() => rerender({ id: undefined }));
    expect(left).toHaveBeenCalledWith(expect.objectContaining({ ticket: "secret-ticket" }));
    expect(useVisit.getState().visit).toBeUndefined();
    expect(useVisit.getState().address).toBeUndefined();
    expect(useChatCall.getState().call).toBeUndefined();
    expect(useCallOutcome.getState().outcome).toBeUndefined();
    expect(useCallScreen.getState().call).toBeNull();
    expect(result.current).toBe(true);
  });
});

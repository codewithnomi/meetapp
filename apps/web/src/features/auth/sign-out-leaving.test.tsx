// Signing out during a call (F17 TC-F17-46, 47; AC-F17-16): it leaves the call first and signs out only
// once the call is over; if leaving doesn't finish within 5 s the person stays signed in and is told.
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallCorner } from "../call-corner/index.ts";
import { SignOutFailedNotice, useSignOutLeavingFirst } from "./sign-out-leaving.tsx";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("./session.ts", () => ({ useSignOut: () => ({ mutate: signOut, isPending: false }) }));

/** As the call host registers it: in a call until `end` runs. */
function inCall(leave: (end: () => void) => void) {
  let on = true;
  useCallCorner.getState().register({ inCall: () => on, leave: () => leave(() => (on = false)) });
}

afterEach(() => {
  useCallCorner.getState().register(undefined);
  signOut.mockClear();
  vi.useRealTimers();
});

describe("signing out during a call", () => {
  it("TC-F17-46 [AC-F17-16] without a call it signs out at once", () => {
    const { result } = renderHook(() => useSignOutLeavingFirst());
    act(() => result.current.mutate());
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("TC-F17-46 [AC-F17-16] during a call it leaves first, then signs out", async () => {
    const leave = vi.fn((end: () => void) => setTimeout(end, 150));
    inCall(leave);
    const { result } = renderHook(() => useSignOutLeavingFirst());
    act(() => result.current.mutate());
    expect(leave).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it("TC-F17-47 [AC-F17-16] when leaving doesn't finish within 5 s it stays signed in and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    inCall(() => undefined);
    render(<SignOutFailedNotice />);
    const { result } = renderHook(() => useSignOutLeavingFirst());
    act(() => result.current.mutate());
    await act(() => vi.advanceTimersByTimeAsync(5_200));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't leave the call. Try again.")).toBeInTheDocument();
  });
});

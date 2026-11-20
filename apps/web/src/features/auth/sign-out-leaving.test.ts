// Signing out during a call (F17 TC-F17-46, 47; AC-F17-16): Sign out and Sign out everywhere leave the
// call first and sign out once it is over; if leaving takes more than 5 s they sign out anyway (a person
// must always be able to sign out; the rest of the call is cleared when the session changes).
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallCorner } from "../call-corner/index.ts";
import { useSignOutEverywhereLeavingFirst, useSignOutLeavingFirst } from "./sign-out-leaving.ts";

const fake = vi.hoisted(() => ({ signOut: vi.fn(), everywhere: vi.fn() }));
vi.mock("./session.ts", () => ({
  useSignOut: () => ({ mutate: fake.signOut, isPending: false }),
  useSignOutEverywhere: () => ({ mutate: fake.everywhere, isPending: false, error: null }),
}));

/** As the call host registers it: in a call until `end` runs. */
function inCall(leave: (end: () => void) => void) {
  let on = true;
  useCallCorner.getState().register({ inCall: () => on, leave: () => leave(() => (on = false)) });
}

afterEach(() => {
  useCallCorner.getState().register(undefined);
  fake.signOut.mockClear();
  fake.everywhere.mockClear();
  vi.useRealTimers();
});

describe("signing out during a call", () => {
  it("TC-F17-46 [AC-F17-16] without a call it signs out at once", () => {
    const { result } = renderHook(() => useSignOutLeavingFirst());
    act(() => result.current.mutate());
    expect(fake.signOut).toHaveBeenCalledOnce();
  });

  it("TC-F17-46 [AC-F17-16] Sign out and Sign out everywhere leave first, then sign out", async () => {
    for (const [hook, signOut] of [
      [useSignOutLeavingFirst, fake.signOut],
      [useSignOutEverywhereLeavingFirst, fake.everywhere],
    ] as const) {
      const leave = vi.fn((end: () => void) => setTimeout(end, 150));
      inCall(leave);
      const { result } = renderHook(() => hook());
      act(() => result.current.mutate());
      expect(leave).toHaveBeenCalledOnce();
      expect(signOut).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true);
      await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    }
  });

  it("TC-F17-47 [AC-F17-16] when leaving takes more than 5 s it signs out anyway", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    inCall(() => undefined);
    const { result } = renderHook(() => useSignOutLeavingFirst());
    act(() => result.current.mutate());
    await act(() => vi.advanceTimersByTimeAsync(5_200));
    expect(fake.signOut).toHaveBeenCalledOnce();
  });
});

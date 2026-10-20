// What screen readers hear: at most one message every 2 seconds, the newest of each kind (AC-F02-21, 44).
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAnnouncer } from "./announcer.ts";

afterEach(() => vi.useRealTimers());

describe("announcer", () => {
  it("TC-F02-89 [AC-F02-44] one message per 2 seconds; a newer one of the same kind replaces the waiting one", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnnouncer());
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.current).toBe("");
    act(() => {
      result.current.announce("join", "Ann joined");
      result.current.announce("join", "Bo joined");
      result.current.announce("hand", "Cy raised a hand");
    });
    expect(result.current.current).toBe("");
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.current).toBe("Bo joined");
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.current).toBe("Cy raised a hand");
  });

  it("TC-F02-89 [AC-F02-44] stops its clock when the screen closes", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useAnnouncer());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

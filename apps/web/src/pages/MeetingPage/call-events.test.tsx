// Reactions stay 3 seconds each, and server messages show their notice (AC-F02-21, 24, 33).
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallEvents, usePeopleAnnouncements } from "./call-events.ts";
import type { CallPerson } from "../../features/meetings/index.ts";

afterEach(() => vi.useRealTimers());
const on = () => ({ shareReplaced: vi.fn(), lobbyChanged: vi.fn() });
const person = (id: string, extra: Partial<CallPerson> = {}): CallPerson => ({
  id,
  name: id,
  isYou: false,
  role: "attendee",
  group: "member",
  userId: undefined,
  handRaisedAt: undefined,
  micOn: true,
  cameraOn: false,
  speaking: false,
  weak: false,
  video: undefined,
  screen: undefined,
  joinedAt: 0,
  ...extra,
});

describe("reactions", () => {
  it("TC-F02-48 [AC-F02-24] a reaction goes after 3 seconds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCallEvents(on()));
    act(() => result.current.showReaction("ann", "applause"));
    act(() => void vi.advanceTimersByTime(2_999));
    expect(result.current.reactions).toEqual({ ann: "applause" });
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.reactions).toEqual({});
  });

  it("T-fix-3 a second reaction from the same person stays its full 3 seconds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCallEvents(on()));
    act(() => result.current.showReaction("ann", "applause"));
    act(() => void vi.advanceTimersByTime(2_000));
    act(() => result.current.showReaction("ann", "love"));
    act(() => void vi.advanceTimersByTime(2_000));
    expect(result.current.reactions).toEqual({ ann: "love" });
    act(() => void vi.advanceTimersByTime(1_000));
    expect(result.current.reactions).toEqual({});
  });

  it("TC-F02-48 [AC-F02-24] reactions from different people run on their own clocks", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCallEvents(on()));
    act(() => result.current.showReaction("ann", "applause"));
    act(() => void vi.advanceTimersByTime(1_000));
    act(() => result.current.showReaction("bo", "love"));
    act(() => void vi.advanceTimersByTime(2_000));
    expect(result.current.reactions).toEqual({ bo: "love" });
  });

  it("TC-F02-48 [AC-F02-24] leaving the screen clears the clocks", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCallEvents(on()));
    act(() => result.current.showReaction("ann", "applause"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("server messages", () => {
  it("TC-F02-47 [AC-F02-33] muted by someone shows a notice, announces it, and can be dismissed", () => {
    const { result } = renderHook(() => useCallEvents(on()));
    act(() => result.current.onControl({ type: "muted_by", by: "Ann" }));
    expect(result.current.notice).toEqual({ kind: "muted", by: "Ann" });
    act(() => result.current.clearNotice());
    expect(result.current.notice).toBeUndefined();
    act(() => result.current.onControl({ type: "muted_by" }));
    expect(result.current.notice).toMatchObject({ kind: "muted", by: expect.any(String) });
  });

  it("TC-F02-49 [AC-F02-25] a replaced share stops our own and says so; ending soon and lobby changes pass on", () => {
    const handlers = on();
    const { result } = renderHook(() => useCallEvents(handlers));
    act(() => result.current.onControl({ type: "share_replaced" }));
    expect(handlers.shareReplaced).toHaveBeenCalled();
    expect(result.current.notice).toEqual({ kind: "shareEnded" });
    act(() => result.current.onControl({ type: "ending_soon" }));
    expect(result.current.notice).toEqual({ kind: "endingSoon" });
    act(() => result.current.onControl({ type: "lobby_changed" }));
    expect(handlers.lobbyChanged).toHaveBeenCalled();
    act(() => result.current.onControl({ type: "unknown" }));
    expect(result.current.notice).toEqual({ kind: "endingSoon" });
  });
});

describe("people announcements", () => {
  it("TC-F02-21 [AC-F02-21] the first list is silent; joins, leaves, hands and a new speaker are announced", () => {
    const announce = vi.fn();
    const { rerender } = renderHook(({ people }) => usePeopleAnnouncements(people, announce), {
      initialProps: { people: [person("me", { isYou: true }), person("ann")] },
    });
    expect(announce).not.toHaveBeenCalled();
    rerender({ people: [person("me", { isYou: true }), person("bo", { speaking: true })] });
    const kinds = announce.mock.calls.map(([kind]) => kind);
    expect(kinds).toEqual(expect.arrayContaining(["join-bo", "join-ann", "speaker"]));
    announce.mockClear();
    rerender({ people: [person("me", { isYou: true }), person("bo", { speaking: true, handRaisedAt: "t" })] });
    expect(announce.mock.calls.map(([kind]) => kind)).toEqual(["hand-bo"]);
  });
});

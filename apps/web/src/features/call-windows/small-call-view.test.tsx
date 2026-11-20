// useSmallCallView (F17 TC-F17-12, 13; AC-F17-02, 04, 05): the small call view's words and buttons from
// the call screen's store. Its buttons run the call screen's own handlers; Leave sends an organizer to the
// full call (where they may end the meeting for everyone) and lets everyone else leave at once.
import type { CallWindowsCall } from "@meetapp/contracts";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallScreen, type CallScreenExtras } from "./call-screen.ts";
import { useSmallCallView } from "./small-call-view.tsx";

const call: CallWindowsCall = {
  title: "Release team",
  joinedAt: Date.now(),
  people: 3,
  phase: "in-call",
  speaker: { name: "Sara Malik", initials: "SM", hasVideo: false, sharing: false },
  mic: true,
  camera: false,
  hand: false,
  canUnmute: true,
  canShare: true,
};

function publish(extras: CallScreenExtras = {}, over: Partial<CallWindowsCall> = {}) {
  const controls = { toggleMic: vi.fn(), toggleCamera: vi.fn(), share: vi.fn(), toggleHand: vi.fn(), leave: vi.fn() };
  useCallScreen.getState().publish({ ...call, ...over }, controls, extras);
  return controls;
}

afterEach(() => useCallScreen.getState().clear());

const view = (showFull = vi.fn()) => renderHook(() => useSmallCallView(showFull)).result.current;

describe("useSmallCallView", () => {
  it("TC-F17-12 [AC-F17-05] a member's Leave leaves at once; mute and camera run the call screen's handlers", () => {
    const controls = publish();
    const showFull = vi.fn();
    const props = view(showFull);
    props?.leave.onClick();
    expect(controls.leave).toHaveBeenCalledOnce();
    expect(showFull).not.toHaveBeenCalled();
    props?.mic.onClick();
    props?.camera.onClick();
    expect(controls.toggleMic).toHaveBeenCalledOnce();
    expect(controls.toggleCamera).toHaveBeenCalledOnce();
    expect(props).toMatchObject({ title: "Release team", caption: "Sara Malik is speaking", controls: true });
    expect(props?.sharing).toBeUndefined();
  });

  it("TC-F17-13 [AC-F17-05] an organizer's Leave shows the full call with its Leave menu", () => {
    const controls = publish({ leaveChoices: true, sharing: true });
    const showFull = vi.fn();
    const props = view(showFull);
    props?.leave.onClick();
    expect(showFull).toHaveBeenCalledOnce();
    expect(controls.leave).not.toHaveBeenCalled();
    expect(props?.sharing).toBe("You're sharing");
  });

  it("TC-F17-19 [AC-F17-07] the lobby and Calling show only Leave or Cancel; no call, no view", () => {
    expect(view()).toBeUndefined();
    publish({}, { phase: "lobby" });
    expect(view()).toMatchObject({ controls: false, caption: "Waiting to be let in…", captionIsStatus: true });
    publish({}, { phase: "calling" });
    expect(view()?.leave.text).toBe("Cancel");
  });

  it("TC-F17-16 [AC-F17-06, 18] a dropped connection shows Reconnecting…, announced, with only Leave", () => {
    publish({}, { phase: "reconnecting" });
    expect(view()).toMatchObject({ caption: "Reconnecting…", captionIsStatus: true, controls: false });
  });
});

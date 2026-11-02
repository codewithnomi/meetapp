// The small call window's page (F16 T6): shows what the desktop app sends and sends each press back
// (AC-F16-02, 07, 15, 16, 21). The bridge is faked: window.meetappCallWindow.
import type { CallWindowView, CallWindowsCall } from "@meetapp/contracts";
import { act as react, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../app/i18n.ts";
import { CallWindowPage } from "./CallWindowPage.tsx";

let show: (view: CallWindowView) => void = () => undefined;
let frame: (bytes: ArrayBuffer) => void = () => undefined;
const sent = vi.fn();

beforeEach(() => {
  sent.mockReset();
  (window as { meetappCallWindow?: unknown }).meetappCallWindow = {
    onState: (listener: (view: CallWindowView) => void) => {
      show = listener;
      return () => undefined;
    },
    act: sent,
    onFrame: (listener: (bytes: ArrayBuffer) => void) => {
      frame = listener;
      return () => undefined;
    },
  };
  URL.createObjectURL = vi.fn(() => "blob:app://meetapp/frame-1");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  delete (window as { meetappCallWindow?: unknown }).meetappCallWindow;
});

const call: CallWindowsCall = {
  title: "Release team",
  joinedAt: Date.now() - 65_000,
  people: 4,
  phase: "in-call",
  speaker: { name: "Sara Malik", initials: "SM", hasVideo: true, sharing: false },
  mic: true,
  camera: false,
  hand: false,
  canUnmute: true,
  canShare: true,
};

describe("CallWindowPage", () => {
  it("TC-F16-04 [AC-F16-02, AC-F16-21] a ring shows the caller and each answer goes back to the desktop app", async () => {
    render(<CallWindowPage />);
    react(() =>
      show({
        kind: "ring",
        ring: { callId: "c1", caller: { name: "Sara Malik", initials: "SM" }, kind: "video", chatName: "Release team" },
      }),
    );
    expect(screen.getByRole("alertdialog", { name: "Incoming video call from Sara Malik" })).toBeInTheDocument();
    expect(screen.getByText("Video call · Release team")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept with audio" }));
    await userEvent.click(screen.getByRole("button", { name: /^Hide/ }));
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(sent.mock.calls.map(([a]) => a)).toEqual([
      { name: "accept", callId: "c1", video: false },
      { name: "hide", callId: "c1" },
      { name: "decline", callId: "c1" },
    ]);
  });

  it("TC-F16-14 [AC-F16-07] busy: the line and the leave-and-accept names", () => {
    render(<CallWindowPage />);
    react(() =>
      show({
        kind: "ring",
        ring: { callId: "c1", caller: { name: "Omar", initials: "O" }, kind: "audio", busyIn: "Design review" },
      }),
    );
    expect(screen.getByText("You're in Design review. Accepting leaves it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave current call and accept with video" })).toBeInTheDocument();
  });

  it("TC-F16-31 [AC-F16-15, AC-F16-16] the mini window shows the call and live video; its buttons go back", async () => {
    render(<CallWindowPage />);
    react(() => show({ kind: "mini", call }));
    expect(screen.getByText("00:01:05 · 4 people")).toBeInTheDocument();
    expect(screen.getByText("Sara Malik is speaking")).toBeInTheDocument();
    react(() => frame(new ArrayBuffer(8)));
    expect(document.querySelector('img[src="blob:app://meetapp/frame-1"]')).not.toBeNull();
    for (const name of [
      "Mute (⌘⇧M)",
      "Turn camera on (⌘⇧O)",
      "Share screen",
      "Raise your hand (⌘⇧K)",
      "Leave",
      "Back to the call window",
    ])
      await userEvent.click(screen.getByRole("button", { name }));
    expect(sent.mock.calls.map(([a]) => (a as { name: string }).name)).toEqual([
      "toggleMic",
      "toggleCamera",
      "share",
      "toggleHand",
      "leave",
      "backToCall",
    ]);
  });

  it("TC-F16-31 [AC-F16-16, AC-F16-18] locked microphone, reconnecting and calling", () => {
    render(<CallWindowPage />);
    react(() => show({ kind: "mini", call: { ...call, mic: false, canUnmute: false } }));
    expect(screen.getByRole("button", { name: "Your microphone is turned off by the organizer" })).toBeDisabled();
    react(() => show({ kind: "mini", call: { ...call, phase: "reconnecting" } }));
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share screen" })).toBeNull();
    react(() => show({ kind: "mini", call: { ...call, phase: "calling", title: "Sara Malik" } }));
    expect(screen.getByText("Calling Sara Malik…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows nothing until the desktop app sends something", () => {
    const { container } = render(<CallWindowPage />);
    expect(container).toBeEmptyDOMElement();
  });
});

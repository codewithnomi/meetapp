// RingWindow tests (F16 AC-F16-02, 04, 07, 21): who calls, the answers and × with full names, the busy
// line, no focus taken on arrival, the keyboard and Escape.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RingWindow } from "./RingWindow.tsx";

const props = () => ({
  label: "Incoming video call from Sara Malik",
  callerName: "Sara Malik",
  subtitle: "Video call · Release team",
  video: { label: "Accept with video", short: "Video", onClick: vi.fn() },
  audio: { label: "Accept with audio", short: "Audio", onClick: vi.fn() },
  decline: { label: "Decline", short: "Decline", onClick: vi.fn() },
  hide: { label: "Hide (the call keeps ringing in MeetApp)", onClick: vi.fn() },
});

describe("RingWindow", () => {
  it("TC-F16-04 [AC-F16-02] shows the caller, the kind of call, the group, and four buttons", async () => {
    const p = props();
    render(<RingWindow {...p} />);
    expect(screen.getByRole("alertdialog", { name: "Incoming video call from Sara Malik" })).toBeInTheDocument();
    expect(screen.getByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getByText("Video call · Release team")).toBeInTheDocument();
    expect(screen.getByText("SM")).toBeInTheDocument();
    for (const name of [
      "Accept with video",
      "Accept with audio",
      "Decline",
      "Hide (the call keeps ringing in MeetApp)",
    ])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Hide/ }));
    expect(p.hide.onClick).toHaveBeenCalledOnce();
    expect(p.decline.onClick).not.toHaveBeenCalled();
  });

  it("TC-F16-04 [AC-F16-02] a photo is shown when there is one", () => {
    render(<RingWindow {...props()} photoUrl="data:image/png;base64,AAAA" />);
    expect(document.querySelector('img[src^="data:image/png"]')).not.toBeNull();
  });

  it("TC-F16-14 [AC-F16-07] during another call it says so and the answers say they leave it", () => {
    const p = props();
    p.video.label = "Leave current call and accept with video";
    p.audio.label = "Leave current call and accept with audio";
    render(<RingWindow {...p} busyNote="You're in Release team. Accepting leaves it." />);
    expect(screen.getByText("You're in Release team. Accepting leaves it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave current call and accept with video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave current call and accept with audio" })).toBeInTheDocument();
  });

  it("TC-F16-48 [AC-F16-21] takes no focus on arrival; Tab reaches every button; Enter answers; Escape declines", async () => {
    const p = props();
    render(<RingWindow {...p} />);
    expect(document.body).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /^Hide/ })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Accept with video" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(p.audio.onClick).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Escape}");
    expect(p.decline.onClick).toHaveBeenCalledOnce();
  });
});

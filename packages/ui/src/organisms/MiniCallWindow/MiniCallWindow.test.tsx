// MiniCallWindow tests (F16 AC-F16-15, 16, 18, 21): what it shows in each state, each button reports
// itself with a name that matches its state, and the keyboard reaches every button.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MiniCallWindow, type MiniCallWindowProps } from "./MiniCallWindow.tsx";

const props = (over: Partial<MiniCallWindowProps> = {}): MiniCallWindowProps => ({
  label: "Call: Release team",
  title: "Release team",
  details: "12:48 · 4 people",
  speakerName: "Sara Malik",
  caption: "Sara Malik is speaking",
  controls: true,
  controlsLabel: "Call controls",
  mic: { label: "Mute (⌘⇧M)", on: true, onClick: vi.fn() },
  camera: { label: "Turn camera on (⌘⇧O)", on: false, onClick: vi.fn() },
  share: { label: "Share screen", onClick: vi.fn() },
  hand: { label: "Raise your hand (⌘⇧K)", on: false, onClick: vi.fn() },
  leave: { label: "Leave", onClick: vi.fn() },
  back: { label: "Back to the call window", onClick: vi.fn() },
  ...over,
});

describe("MiniCallWindow", () => {
  it("TC-F16-31 [AC-F16-15] shows the call, the time and people, the speaker and every button", async () => {
    const p = props();
    render(<MiniCallWindow {...p} />);
    expect(screen.getByRole("region", { name: "Call: Release team" })).toBeInTheDocument();
    expect(screen.getByText("Release team")).toBeInTheDocument();
    expect(screen.getByText("12:48 · 4 people")).toBeInTheDocument();
    expect(screen.getByText("Sara Malik is speaking")).toBeInTheDocument();
    expect(screen.getByText("SM")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Call controls" });
    for (const name of ["Mute (⌘⇧M)", "Turn camera on (⌘⇧O)", "Share screen", "Raise your hand (⌘⇧K)", "Leave"])
      expect(group.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    for (const [name, handler] of [
      ["Mute (⌘⇧M)", p.mic.onClick],
      ["Share screen", p.share.onClick],
      ["Back to the call window", p.back.onClick],
      ["Leave", p.leave.onClick],
    ] as const) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it("TC-F16-31 [AC-F16-15] the speaker's live video replaces the picture", () => {
    render(<MiniCallWindow {...props({ video: <canvas data-testid="live" /> })} />);
    expect(screen.getByTestId("live")).toBeInTheDocument();
    expect(screen.queryByText("SM")).toBeNull();
  });

  it("TC-F16-31 [AC-F16-14, AC-F16-18] lobby, calling and reconnecting show the status and only Leave or Cancel", () => {
    render(
      <MiniCallWindow
        {...props({ controls: false, caption: "Reconnecting…", leave: { label: "Cancel", onClick: vi.fn() } })}
      />,
    );
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mute (⌘⇧M)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("TC-F16-31 [AC-F16-16] a microphone the organizer turned off can't be pressed", async () => {
    const mic = {
      label: "Your microphone is turned off by the organizer",
      on: false,
      onClick: vi.fn(),
      disabled: true,
    };
    render(<MiniCallWindow {...props({ mic })} />);
    await userEvent.click(screen.getByRole("button", { name: mic.label }));
    expect(mic.onClick).not.toHaveBeenCalled();
  });

  it("TC-F16-48 [AC-F16-21] who speaks isn't announced; a status is; an unavailable button stays reachable", async () => {
    const { rerender } = render(<MiniCallWindow {...props()} />);
    expect(screen.getByText("Sara Malik is speaking")).not.toHaveAttribute("aria-live");
    rerender(<MiniCallWindow {...props({ caption: "Reconnecting…", captionIsStatus: true, controls: false })} />);
    expect(screen.getByText("Reconnecting…")).toHaveAttribute("aria-live", "polite");
    const share = { label: "Only presenters can share", onClick: vi.fn(), disabled: true };
    rerender(<MiniCallWindow {...props({ share })} />);
    const button = screen.getByRole("button", { name: "Only presenters can share" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(share.onClick).not.toHaveBeenCalled();
  });

  it("TC-F16-48 [AC-F16-21] Tab reaches every button in order; Space presses", async () => {
    const p = props();
    render(<MiniCallWindow {...p} />);
    const order = [
      "Back to the call window",
      "Mute (⌘⇧M)",
      "Turn camera on (⌘⇧O)",
      "Share screen",
      "Raise your hand (⌘⇧K)",
      "Leave",
    ];
    for (const name of order) {
      await userEvent.tab();
      expect(screen.getByRole("button", { name })).toHaveFocus();
    }
    await userEvent.keyboard(" ");
    expect(p.leave.onClick).toHaveBeenCalledOnce();
  });
});

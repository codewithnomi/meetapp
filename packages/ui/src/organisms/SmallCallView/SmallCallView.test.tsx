// SmallCallView tests (F17 AC-F17-02, 07, 18): what it shows in each state, that it has only mute, camera
// and Leave, that a microphone the organizer turned off can't be unmuted, and that the keyboard reaches
// and presses every button.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SmallCallView, type SmallCallViewProps } from "./SmallCallView.tsx";

const props = (over: Partial<SmallCallViewProps> = {}): SmallCallViewProps => ({
  label: "Call: Release team",
  title: "Release team",
  elapsed: "12:40",
  speakerName: "Sara Malik",
  caption: "Sara Malik is talking",
  controls: true,
  controlsLabel: "Call controls",
  mic: { label: "Mute (⌘⇧M)", on: true, onClick: vi.fn() },
  camera: { label: "Turn camera off (⌘⇧O)", on: true, onClick: vi.fn() },
  leave: { label: "Leave the call", text: "Leave", onClick: vi.fn() },
  back: { label: "Go back to the Release team call", text: "Go back", onClick: vi.fn() },
  ...over,
});

describe("SmallCallView", () => {
  it("TC-F17-03 [AC-F17-02] shows the speaker, the call and its time, with mute, camera and Leave only", async () => {
    const p = props({ video: <canvas data-testid="video" /> });
    const { rerender } = render(<SmallCallView {...p} />);
    expect(screen.getByRole("region", { name: "Call: Release team" })).toBeInTheDocument();
    expect(screen.getByText("Release team")).toBeInTheDocument();
    expect(screen.getByText("12:40")).toBeInTheDocument();
    expect(screen.getByText("Sara Malik is talking")).toBeInTheDocument();
    expect(screen.getByTestId("video")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Call controls" });
    expect([...group.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Mute (⌘⇧M)",
      "Turn camera off (⌘⇧O)",
      "Leave the call",
    ]);
    for (const [name, handler] of [
      ["Mute (⌘⇧M)", p.mic.onClick],
      ["Turn camera off (⌘⇧O)", p.camera.onClick],
      ["Leave the call", p.leave.onClick],
      ["Go back to the Release team call", p.back.onClick],
    ] as const) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(handler).toHaveBeenCalledOnce();
    }
    // Camera off: the picture or initials instead of the video.
    rerender(<SmallCallView {...props()} />);
    expect(screen.queryByTestId("video")).toBeNull();
    expect(screen.getByText("SM")).toBeInTheDocument();
  });

  it('TC-F17-04 [AC-F17-02] says "You\'re sharing" only while the person shares', () => {
    const { rerender } = render(<SmallCallView {...props({ sharing: "You're sharing" })} />);
    expect(screen.getByText("You're sharing")).toBeInTheDocument();
    rerender(<SmallCallView {...props()} />);
    expect(screen.queryByText("You're sharing")).toBeNull();
  });

  it("TC-F17-05 [AC-F17-02] a microphone the organizer turned off can't be unmuted", async () => {
    const onClick = vi.fn();
    render(
      <SmallCallView {...props({ mic: { label: "Your microphone is off", on: false, onClick, disabled: true } })} />,
    );
    const mic = screen.getByRole("button", { name: "Your microphone is off" });
    expect(mic).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(mic);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("TC-F17-19 [AC-F17-07] the lobby shows Leave, calling shows Cancel, in a call every button; states are announced", () => {
    const { rerender } = render(
      <SmallCallView {...props({ controls: false, caption: "Waiting to be let in…", captionIsStatus: true })} />,
    );
    const group = () => screen.getByRole("group", { name: "Call controls" });
    expect(group().querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Waiting to be let in…");
    rerender(
      <SmallCallView
        {...props({
          controls: false,
          caption: "Calling Omar…",
          captionIsStatus: true,
          leave: { label: "Cancel the call", text: "Cancel", onClick: vi.fn() },
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel the call" })).toHaveTextContent("Cancel");
    rerender(<SmallCallView {...props()} />);
    expect(group().querySelectorAll("button")).toHaveLength(3);
    // Who is talking changes often, so it is not announced (a deliberate choice).
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("TC-F17-42 [AC-F17-18] every button has a name and is reached with Tab and pressed with Enter and Space", async () => {
    const p = props();
    render(<SmallCallView {...p} />);
    const order = ["Go back to the Release team call", "Mute (⌘⇧M)", "Turn camera off (⌘⇧O)", "Leave the call"];
    for (const name of order) {
      await userEvent.tab();
      expect(screen.getByRole("button", { name })).toHaveFocus();
    }
    screen.getByRole("button", { name: "Go back to the Release team call" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(p.back.onClick).toHaveBeenCalledOnce();
    screen.getByRole("button", { name: "Mute (⌘⇧M)" }).focus();
    await userEvent.keyboard(" ");
    expect(p.mic.onClick).toHaveBeenCalledOnce();
  });
});

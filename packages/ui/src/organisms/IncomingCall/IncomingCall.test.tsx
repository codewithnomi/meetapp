// IncomingCall tests (F15 AC-F15-05, 10, 18): who calls, three answers with full names, focus on the
// first answer, and the busy line during another call.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncomingCall } from "./IncomingCall.tsx";

const answers = () => ({
  video: { label: "Accept with video", short: "Video", onClick: vi.fn() },
  audio: { label: "Accept with audio", short: "Audio", onClick: vi.fn() },
  decline: { label: "Decline", short: "Decline", onClick: vi.fn() },
});

describe("IncomingCall", () => {
  it("TC-F15-09 [AC-F15-05, AC-F15-18] names the caller, takes focus, and each answer reports itself", async () => {
    const a = answers();
    render(
      <IncomingCall label="Incoming call" callerName="Sara <b>Malik</b>" subtitle="Video call · Release team" {...a} />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Incoming call" });
    expect(dialog).toHaveAccessibleDescription(/Sara <b>Malik<\/b>/);
    expect(screen.getByRole("button", { name: "Accept with video" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Accept with audio" }));
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(a.audio.onClick).toHaveBeenCalledOnce();
    expect(a.decline.onClick).toHaveBeenCalledOnce();
    expect(a.video.onClick).not.toHaveBeenCalled();
  });

  it("TC-F15-25 [AC-F15-10] during another call the busy line shows and accept says it leaves", () => {
    const a = answers();
    a.video.label = "Leave current call and accept with video";
    render(
      <IncomingCall
        label="Incoming call"
        callerName="Sara"
        subtitle="Audio call"
        busyNote="Accepting leaves it."
        {...a}
      />,
    );
    expect(screen.getByText("Accepting leaves it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave current call and accept with video" })).toBeInTheDocument();
  });

  it("TC-F15-56 [AC-F15-18] Escape declines, and focus goes back to the earlier element when the window closes", async () => {
    const a = answers();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const view = render(<IncomingCall label="Incoming call" callerName="Sara" subtitle="Audio call" {...a} />);
    expect(screen.getByRole("button", { name: "Accept with video" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(a.decline.onClick).toHaveBeenCalledOnce();
    view.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("TC-F15-56 [AC-F15-18] Escape does nothing when focus is outside the window", async () => {
    const a = answers();
    const outside = document.createElement("button");
    document.body.append(outside);
    render(<IncomingCall label="Incoming call" callerName="Sara" subtitle="Audio call" {...a} />);
    outside.focus();
    await userEvent.keyboard("{Escape}");
    expect(a.decline.onClick).not.toHaveBeenCalled();
    outside.remove();
  });
});

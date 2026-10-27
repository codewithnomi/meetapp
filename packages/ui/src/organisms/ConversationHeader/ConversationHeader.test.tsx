// ConversationHeader tests (TC-F14-79, AC-F14-05, 26): the name as a heading, the status, the two call
// buttons, and More with the page's actions.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConversationHeader } from "./ConversationHeader.tsx";

describe("ConversationHeader", () => {
  it("TC-F14-79 [AC-F14-26, AC-F14-05] name, status, calls and More", async () => {
    const onVideo = vi.fn();
    const pin = vi.fn();
    render(
      <ConversationHeader
        kind="direct"
        title="Bilal Ahmed"
        status={{ value: "available", label: "Available" }}
        subtitle="Available"
        calls={{ videoLabel: "Video call", audioLabel: "Audio call", onVideo, onAudio: vi.fn() }}
        moreLabel="More for this chat"
        actions={[{ id: "pin", label: "Pin", onSelect: pin }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Bilal Ahmed" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Available" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Video call" }));
    expect(onVideo).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Audio call" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "More for this chat" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Pin" }));
    expect(pin).toHaveBeenCalledOnce();
  });

  it("TC-F15-04 [AC-F15-02] off in a read-only chat, with the reason as the tooltip", () => {
    render(
      <ConversationHeader
        kind="direct"
        title="Mei Lin"
        calls={{
          videoLabel: "Video call",
          audioLabel: "Audio call",
          onVideo: vi.fn(),
          onAudio: vi.fn(),
          disabled: true,
          disabledReason: "You can call once they accept your chat request.",
        }}
        moreLabel="More"
        actions={[]}
      />,
    );
    for (const name of ["Video call", "Audio call"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "You can call once they accept your chat request.");
    }
  });

  it("TC-F15-06 [AC-F15-03] while a call runs, Join replaces the call buttons", async () => {
    const onJoin = vi.fn();
    render(
      <ConversationHeader
        kind="group"
        title="Release team"
        calls={{
          videoLabel: "Video call",
          audioLabel: "Audio call",
          onVideo: vi.fn(),
          onAudio: vi.fn(),
          join: { label: "Join", onJoin },
        }}
        moreLabel="More"
        actions={[]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Video call" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("TC-F15-57 [AC-F15-18] while starting, the call buttons can't be pressed again", () => {
    render(
      <ConversationHeader
        kind="direct"
        title="Bilal"
        calls={{
          videoLabel: "Video call",
          audioLabel: "Audio call",
          onVideo: vi.fn(),
          onAudio: vi.fn(),
          pending: true,
        }}
        moreLabel="More"
        actions={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Video call" })).toBeDisabled();
  });
});

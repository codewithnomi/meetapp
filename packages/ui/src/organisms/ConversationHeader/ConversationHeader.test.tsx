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
});

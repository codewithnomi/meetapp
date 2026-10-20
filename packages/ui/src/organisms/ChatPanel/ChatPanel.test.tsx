// ChatPanel tests (F03 TC-F03-15, 16, 17, 75): the empty state, the New messages button, and messages in
// a log that screen readers announce.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel, type ChatPanelProps } from "./ChatPanel.tsx";

const BASE: ChatPanelProps = {
  title: "Chat",
  closeLabel: "Close chat",
  onClose: vi.fn(),
  listLabel: "Messages",
  messages: <p>Hello</p>,
};

describe("ChatPanel", () => {
  it("TC-F03-75 [AC-F03-45] messages are in a log that is announced", () => {
    render(<ChatPanel {...BASE} />);
    const log = screen.getByRole("log", { name: "Messages" });
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveTextContent("Hello");
  });

  it("TC-F03-17 [AC-F03-09] an empty chat says so", () => {
    render(<ChatPanel {...BASE} empty={{ title: "No messages yet", hint: "Seen by everyone" }} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("TC-F03-16 [AC-F03-08] New messages takes the person to the newest", async () => {
    const onClick = vi.fn();
    render(<ChatPanel {...BASE} newMessages={{ label: "New messages", onClick }} />);
    await userEvent.click(screen.getByRole("button", { name: "New messages" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("TC-F03-75 [AC-F03-45] Escape closes the panel", async () => {
    const onClose = vi.fn();
    render(<ChatPanel {...BASE} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

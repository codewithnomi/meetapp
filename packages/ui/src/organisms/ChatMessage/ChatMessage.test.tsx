// ChatMessage tests (F03 TC-F03-11, 21, 23): name and time are spoken, deleted and failed states show,
// Retry and reactions report back.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage, type ChatMessageProps } from "./ChatMessage.tsx";

const BASE: ChatMessageProps = {
  id: "m1",
  name: "Sara Malik",
  time: "10:42",
  document: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Thanks!" }] }] },
  onOpenLink: vi.fn(),
  onCopyCode: vi.fn(),
  copyLabel: "Copy",
};

describe("ChatMessage", () => {
  it("TC-F03-01 [AC-F03-01] [AC-F03-45] the message is named by its sender and time", () => {
    render(<ChatMessage {...BASE} />);
    expect(screen.getByRole("article", { name: "Sara Malik, 10:42" })).toHaveTextContent("Thanks!");
  });

  it("TC-F03-21 [AC-F03-10] a deleted message shows only the deleted text", () => {
    render(<ChatMessage {...BASE} deletedText="This message was deleted" />);
    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
    expect(screen.queryByText("Thanks!")).toBeNull();
  });

  it("TC-F03-11 [AC-F03-05] a message that wasn't sent offers Retry", async () => {
    const onRetry = vi.fn();
    render(<ChatMessage {...BASE} own status={{ kind: "failed", label: "Not sent", retryLabel: "Retry", onRetry }} />);
    expect(screen.getByText("Not sent")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("TC-F03-23 [AC-F03-13] a reaction chip toggles the viewer's reaction", async () => {
    const onToggle = vi.fn();
    render(
      <ChatMessage
        {...BASE}
        reactions={[{ emoji: "👍", count: 2, mine: false, label: "Thumbs up, 2 people", onToggle }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Thumbs up, 2 people" }));
    expect(onToggle).toHaveBeenCalled();
  });
});

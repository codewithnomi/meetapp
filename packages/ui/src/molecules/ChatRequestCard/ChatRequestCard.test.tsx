// ChatRequestCard tests (TC-F14-79, AC-F14-10, 11, 13): preview, accept, and delete with "Also block".
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatRequestCard, type ChatRequestCardProps } from "./ChatRequestCard.tsx";

const props = (overrides: Partial<ChatRequestCardProps> = {}): ChatRequestCardProps => ({
  name: "Daniel Cho",
  externalLabel: "(External)",
  intro: "daniel@fabrikam.com wants to chat with you",
  previewLabel: "Preview messages",
  previewListLabel: "Preview of messages",
  onPreview: vi.fn(),
  explanation: "Accept to chat.",
  acceptLabel: "Accept",
  deleteLabel: "Delete",
  onAccept: vi.fn(),
  confirm: {
    title: "Delete this chat request?",
    alsoBlockLabel: "Also block",
    cancelLabel: "Cancel",
    deleteLabel: "Delete",
  },
  onDelete: vi.fn(),
  ...overrides,
});

describe("ChatRequestCard", () => {
  it("TC-F14-79 [AC-F14-10] Preview asks for the messages; then they show as a log", async () => {
    const p = props();
    const { rerender } = render(<ChatRequestCard {...p} />);
    expect(screen.getByRole("heading", { name: /Daniel Cho/ })).toHaveTextContent("(External)");
    await userEvent.click(screen.getByRole("button", { name: "Preview messages" }));
    expect(p.onPreview).toHaveBeenCalledOnce();
    rerender(<ChatRequestCard {...p} preview={[{ id: "1", senderName: "Daniel Cho", text: "Hi", time: "09:30" }]} />);
    expect(screen.getByRole("log", { name: "Preview of messages" })).toHaveTextContent("Hi");
  });

  it("TC-F14-79 [AC-F14-11, AC-F14-13] Accept; Delete asks first and can also block", async () => {
    const p = props();
    render(<ChatRequestCard {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(p.onAccept).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this chat request?" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Also block" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1) ?? dialog);
    expect(p.onDelete).toHaveBeenCalledWith(true);
  });
});

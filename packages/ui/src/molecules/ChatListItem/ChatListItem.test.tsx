// ChatListItem tests (TC-F14-79, AC-F14-01, 02, 26): the row is one button named by the page, shows the
// unread count (99+ above 99), the status dot only for one-to-one chats, and reports a click.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatListItem, type ChatListItemProps } from "./ChatListItem.tsx";

const base: ChatListItemProps = {
  kind: "direct",
  title: "Bilal Ahmed",
  status: { value: "away", label: "Away" },
  lastLine: "You: Thanks",
  time: "10:14",
  unread: 0,
  label: "Bilal Ahmed, Away",
  onSelect: () => undefined,
};

describe("ChatListItem", () => {
  it("TC-F14-79 [AC-F14-01] one button with the page's name; a click selects it", async () => {
    const onSelect = vi.fn();
    render(<ChatListItem {...base} onSelect={onSelect} current />);
    const row = screen.getByRole("button", { name: "Bilal Ahmed, Away" });
    expect(row).toHaveAttribute("aria-current", "true");
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("TC-F14-79 [AC-F14-02] the unread count shows, 99+ above 99", () => {
    const { rerender } = render(<ChatListItem {...base} unread={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    rerender(<ChatListItem {...base} unread={140} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("TC-F14-79 [AC-F14-26] a status dot for a person; none for a meeting chat", () => {
    const { container, rerender } = render(<ChatListItem {...base} />);
    expect(container.querySelector('[data-status="away"]')).not.toBeNull();
    rerender(<ChatListItem {...base} kind="meeting" status={null} />);
    expect(container.querySelector("[data-status]")).toBeNull();
  });
});

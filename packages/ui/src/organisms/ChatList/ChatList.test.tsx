// ChatList tests (TC-F14-79, AC-F14-01–06, 10): heading, New chat, search, pressed filter chips, the
// requests link with its count, pinned rows first, and the empty state.
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatList, type ChatListProps } from "./ChatList.tsx";

const entry = (id: string, title: string) => ({
  id,
  kind: "direct" as const,
  title,
  unread: 0,
  label: title,
  onSelect: vi.fn(),
});

const props = (overrides: Partial<ChatListProps> = {}): ChatListProps => ({
  heading: "Chat",
  newChatLabel: "New chat",
  onNewChat: vi.fn(),
  searchLabel: "Find a chat or person",
  query: "",
  onQueryChange: vi.fn(),
  filtersLabel: "Show",
  filters: [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
  ],
  filter: "all",
  onFilter: vi.fn(),
  requests: { label: "Chat requests", count: 2, onOpen: vi.fn() },
  pinnedLabel: "Pinned",
  listLabel: "Chats",
  pinned: [entry("1", "Bilal Ahmed")],
  others: [entry("2", "Release team")],
  empty: { title: "No chats yet", actionLabel: "Start a chat" },
  ...overrides,
});

describe("ChatList", () => {
  it("TC-F14-79 [AC-F14-01, AC-F14-03, AC-F14-05] pinned first, the chosen filter pressed, filters report", async () => {
    const p = props();
    render(<ChatList {...p} />);
    expect(screen.getByRole("heading", { level: 1, name: "Chat" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Pinned" })).getByRole("button")).toHaveAccessibleName(
      "Bilal Ahmed",
    );
    expect(within(screen.getByRole("list", { name: "Chats" })).getByRole("button")).toHaveAccessibleName(
      "Release team",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(p.onFilter).toHaveBeenCalledWith("unread");
    await userEvent.type(screen.getByRole("textbox", { name: "Find a chat or person" }), "b");
    expect(p.onQueryChange).toHaveBeenCalledWith("b");
  });

  it("TC-F14-79 [AC-F14-10] the requests link shows its count and opens", async () => {
    const p = props();
    render(<ChatList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Chat requests 2" }));
    expect(p.requests?.onOpen).toHaveBeenCalledOnce();
  });

  it("TC-F14-79 [AC-F14-06] no chats: the empty state starts a new chat", async () => {
    const p = props({ pinned: [], others: [], requests: undefined });
    render(<ChatList {...p} />);
    expect(screen.getByText("No chats yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start a chat" }));
    expect(p.onNewChat).toHaveBeenCalledOnce();
  });

  it('TC-F14-79 [AC-F14-06] while loading or after a failure the page\'s message shows, never "No chats yet"', () => {
    render(<ChatList {...props({ pinned: [], others: [], state: <p>Couldn't load your chats</p> })} />);
    expect(screen.getByText("Couldn't load your chats")).toBeInTheDocument();
    expect(screen.queryByText("No chats yet")).not.toBeInTheDocument();
  });
});

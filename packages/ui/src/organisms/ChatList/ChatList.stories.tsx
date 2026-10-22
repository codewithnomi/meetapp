import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatList } from "./ChatList.tsx";

const row = (id: string, title: string, extra: object = {}) => ({
  id,
  kind: "direct" as const,
  title,
  lastLine: "You: Thanks",
  time: "10:14",
  unread: 0,
  label: title,
  onSelect: fn(),
  ...extra,
});

const meta = {
  title: "Organisms/ChatList",
  component: ChatList,
  args: {
    heading: "Chat",
    newChatLabel: "New chat",
    onNewChat: fn(),
    searchLabel: "Find a chat or person",
    query: "",
    onQueryChange: fn(),
    filtersLabel: "Show",
    filters: [
      { id: "all", label: "All" },
      { id: "unread", label: "Unread" },
      { id: "chats", label: "Chats" },
      { id: "meetings", label: "Meeting chats" },
    ],
    filter: "all",
    onFilter: fn(),
    requests: { label: "Chat requests", count: 2, onOpen: fn() },
    pinnedLabel: "Pinned",
    listLabel: "Chats",
    pinned: [row("1", "Bilal Ahmed", { status: { value: "available", label: "Available" }, current: true })],
    others: [
      row("2", "Release team", { kind: "group", unread: 3, lastLine: "Sara: Shipping Thursday" }),
      row("3", "Weekly design review", { kind: "meeting", time: "Mon", lastLine: "Omar: Notes are in" }),
      row("4", "Mei Lin", { lastLine: "Waiting for Mei Lin to accept", time: "11:02" }),
    ],
    empty: { title: "No chats yet", actionLabel: "New chat" },
  },
  decorators: [(Story) => <div className="h-160 w-90">{Story()}</div>],
} satisfies Meta<typeof ChatList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const UnreadFilter: Story = { args: { filter: "unread", requests: undefined } };
export const Empty: Story = { args: { pinned: [], others: [], requests: undefined } };

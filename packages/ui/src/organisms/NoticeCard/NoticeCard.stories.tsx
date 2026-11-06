import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { NoticeCard } from "./NoticeCard.tsx";

const meta = {
  title: "Organisms/NoticeCard",
  component: NoticeCard,
  decorators: [
    (Story, { args }) => (
      <div style={{ width: 360, height: args.kind === "lobby" ? 132 : 96 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    kind: "message",
    title: "Omar Farooq",
    detail: "Omar Farooq",
    text: "Sounds good, I'll send the deck after lunch.",
    person: { name: "Omar Farooq" },
    open: { label: "Open the chat with Omar Farooq", onClick: fn() },
    close: { label: "Close", onClick: fn() },
    onHover: fn(),
  },
} satisfies Meta<typeof NoticeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Message: Story = {};
export const MessageWithPhoto: Story = {
  args: {
    person: {
      name: "Omar Farooq",
      photo:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><rect width='36' height='36' fill='%2393c5fd'/></svg>",
    },
  },
};
export const ManyMessages: Story = { args: { detail: "Release team · 3 new messages" } };
export const PreviewOff: Story = { args: { text: "New message" } };
export const Mention: Story = {
  args: {
    kind: "mention",
    title: "Sara Malik",
    tag: "mentioned you",
    detail: "Release team",
    text: "@Olivia can you check the release notes before 3?",
    person: { name: "Sara Malik" },
  },
};
export const LongNames: Story = {
  args: {
    title: "Maximilian Alexander Featherstonehaugh-Montgomery",
    detail: "Quarterly planning for the very long named product line, Europe and Asia",
    text: "x".repeat(100),
  },
};
export const Lobby: Story = {
  args: {
    kind: "lobby",
    title: "Lee Chen",
    tag: "Guest",
    text: "is waiting in the lobby",
    detail: "Design review: invite flow",
    person: { name: "Lee Chen" },
    open: undefined,
    admit: { label: "Admit", onClick: fn() },
    viewLobby: { label: "View lobby", onClick: fn() },
  },
};
export const LobbyMember: Story = { args: { ...Lobby.args, tag: undefined, title: "Mo Member" } };
export const LobbyMany: Story = {
  args: {
    ...Lobby.args,
    tag: undefined,
    title: "3 people are waiting",
    text: undefined,
    person: undefined,
    admit: undefined,
  },
};
export const StillRunning: Story = {
  args: {
    kind: "running",
    title: "MeetApp is still running",
    detail: undefined,
    text: "You'll find it in the menu bar. Calls and messages still reach you.",
    person: undefined,
    open: undefined,
  },
};

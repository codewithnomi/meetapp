import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatMessage } from "./ChatMessage.tsx";

const meta = {
  title: "Organisms/ChatMessage",
  component: ChatMessage,
  args: {
    id: "m1",
    name: "Bilal Ahmed",
    time: "10:41",
    document: {
      v: 1,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Can someone share the staging link?" }] }],
    },
    onOpenLink: fn(),
    onCopyCode: fn(),
    copyLabel: "Copy",
  },
  decorators: [(Story) => <div className="flex max-w-110 flex-col bg-surface p-4 pt-8">{Story()}</div>],
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Own: Story = { args: { name: "You", own: true, time: "10:43 · Edited" } };
export const Reply: Story = {
  args: { replyTo: { senderName: "Bilal Ahmed", firstLine: "Release checklist for Thursday", onShow: fn() } },
};
export const Reactions: Story = {
  args: {
    reactions: [
      { emoji: "👍", count: 3, mine: false, label: "Thumbs up, 3 people", onToggle: fn() },
      { emoji: "🎉", count: 1, mine: true, label: "Party popper, 1 person, you", onToggle: fn() },
    ],
  },
};
export const Deleted: Story = { args: { deletedText: "This message was deleted" } };
export const NotSent: Story = {
  args: { own: true, name: "You", status: { kind: "failed", label: "Not sent", retryLabel: "Retry", onRetry: fn() } },
};
export const Sending: Story = { args: { own: true, name: "You", status: { kind: "sending", label: "Sending…" } } };

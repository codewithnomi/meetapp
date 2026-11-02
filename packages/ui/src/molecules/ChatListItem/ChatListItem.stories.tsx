import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatListItem } from "./ChatListItem.tsx";

const meta = {
  title: "Molecules/ChatListItem",
  component: ChatListItem,
  args: {
    kind: "direct",
    title: "Bilal Ahmed",
    status: { value: "available", label: "Available" },
    lastLine: "You: Thanks, reading it now",
    time: "10:14",
    unread: 0,
    label: "Bilal Ahmed, Available, 10:14, You: Thanks, reading it now",
    onSelect: fn(),
  },
  decorators: [(Story) => <div className="w-90 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof ChatListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Read: Story = {};
export const Unread: Story = { args: { unread: 3, lastLine: "Bilal: Did QA finish the invite flow?" } };
export const ManyUnread: Story = { args: { unread: 140 } };
export const Current: Story = { args: { current: true } };
export const Muted: Story = { args: { muted: true, mutedLabel: "Muted", unread: 2 } };
export const Group: Story = {
  args: { kind: "group", title: "Release team", status: null, lastLine: "Sara: Shipping Thursday" },
};
export const Meeting: Story = {
  args: { kind: "meeting", title: "Weekly design review", status: null, lastLine: "Omar: Notes are in", time: "Mon" },
};
export const Waiting: Story = {
  args: { title: "Mei Lin", status: null, lastLine: "Waiting for Mei Lin to accept", time: "11:02" },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

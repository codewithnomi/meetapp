import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MessageActions } from "./MessageActions.tsx";

const meta = {
  title: "Molecules/MessageActions",
  component: MessageActions,
  args: {
    label: "Actions for your message",
    quickReactions: [
      { emoji: "👍", label: "React with thumbs up", onReact: fn() },
      { emoji: "❤️", label: "React with heart", onReact: fn() },
      { emoji: "😂", label: "React with laughing face", onReact: fn() },
      { emoji: "😮", label: "React with surprised face", onReact: fn() },
    ],
    moreReactions: { label: "More reactions", onClick: fn() },
    reply: { label: "Reply", onReply: fn() },
    moreLabel: "More actions",
    more: [
      { id: "edit", label: "Edit", onSelect: fn() },
      { id: "copy", label: "Copy text", onSelect: fn() },
      { id: "pin", label: "Pin for everyone", onSelect: fn() },
      { id: "delete", label: "Delete", danger: true, onSelect: fn() },
    ],
  },
  decorators: [(Story) => <div className="bg-surface p-6">{Story()}</div>],
} satisfies Meta<typeof MessageActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const OthersMessage: Story = { args: { more: [{ id: "copy", label: "Copy text", onSelect: fn() }] } };

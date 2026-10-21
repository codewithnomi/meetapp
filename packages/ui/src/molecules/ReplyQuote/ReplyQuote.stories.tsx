import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReplyQuote } from "./ReplyQuote.tsx";

const meta = {
  title: "Molecules/ReplyQuote",
  component: ReplyQuote,
  args: { senderName: "Bilal Ahmed", firstLine: "Release checklist for Thursday", onShow: fn() },
  decorators: [(Story) => <div className="max-w-80 rounded-md bg-surface-sunken p-3">{Story()}</div>],
} satisfies Meta<typeof ReplyQuote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Deleted: Story = { args: { firstLine: "This message was deleted" } };
export const Composing: Story = {
  args: { composing: { title: "Replying to Bilal Ahmed", cancelLabel: "Cancel reply", onCancel: fn() } },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

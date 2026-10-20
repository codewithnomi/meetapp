import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PinnedBar } from "./PinnedBar.tsx";

const meta = {
  title: "Molecules/PinnedBar",
  component: PinnedBar,
  args: { title: "Pinned", text: "Bilal Ahmed: Release checklist for Thursday", onShow: fn() },
  decorators: [(Story) => <div className="max-w-100 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof PinnedBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Several: Story = { args: { position: "1 of 2", next: { label: "Next pinned message", onNext: fn() } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const LongText: Story = { args: { text: "Bilal Ahmed: " + "a very long pinned message ".repeat(6) } };

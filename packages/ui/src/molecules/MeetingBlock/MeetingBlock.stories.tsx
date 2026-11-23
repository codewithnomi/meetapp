import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MeetingBlock } from "./MeetingBlock.tsx";

const meta = {
  title: "Molecules/MeetingBlock",
  component: MeetingBlock,
  args: { title: "Weekly planning", time: "10:00 – 10:30", state: "accepted", stateLabel: "Accepted", onOpen: fn() },
  decorators: [(Story) => <div className="flex h-16 w-48 bg-surface p-2">{Story()}</div>],
} satisfies Meta<typeof MeetingBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accepted: Story = {};
export const NoAnswer: Story = { args: { state: "none", stateLabel: "No answer" } };
export const Maybe: Story = { args: { state: "tentative", stateLabel: "Maybe" } };
export const Declined: Story = { args: { state: "declined", stateLabel: "Declined" } };
export const Cancelled: Story = { args: { state: "cancelled", stateLabel: "Cancelled" } };
export const Series: Story = { args: { repeats: true } };
export const Compact: Story = { args: { compact: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

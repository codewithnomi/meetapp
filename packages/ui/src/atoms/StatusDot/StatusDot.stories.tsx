import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusDot } from "./StatusDot.tsx";

const meta = {
  title: "Atoms/StatusDot",
  component: StatusDot,
  args: { status: "available", label: "Available" },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};
export const Away: Story = { args: { status: "away", label: "Away" } };
export const InACall: Story = { args: { status: "in_call", label: "In a call" } };
export const Offline: Story = { args: { status: "offline", label: "Offline" } };
/** F04: set by hand. */
export const Busy: Story = { args: { status: "busy", label: "Busy" } };
export const DoNotDisturb: Story = { args: { status: "dnd", label: "Do not disturb" } };
export const BeRightBack: Story = { args: { status: "brb", label: "Be right back" } };

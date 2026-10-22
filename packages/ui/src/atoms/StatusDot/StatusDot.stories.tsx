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
export const InAMeeting: Story = { args: { status: "in_meeting", label: "In a meeting" } };
export const Offline: Story = { args: { status: "offline", label: "Offline" } };

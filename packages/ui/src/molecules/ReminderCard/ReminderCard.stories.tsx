import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReminderCard } from "./ReminderCard.tsx";

const meta = {
  title: "Molecules/ReminderCard",
  component: ReminderCard,
  args: {
    heading: "Starts in 15 min",
    title: "Weekly planning",
    time: "10:00 – 10:30",
    open: { label: "Open Weekly planning", onClick: fn() },
    snooze: { label: "Snooze 5 min", onClick: fn() },
    dismiss: { label: "Dismiss", onClick: fn() },
  },
} satisfies Meta<typeof ReminderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Before: Story = {};
export const StartingNow: Story = { args: { heading: "Starting now", join: { label: "Join", onClick: fn() } } };
export const LongTitle: Story = { args: { title: "Quarterly planning with the whole product and design group" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

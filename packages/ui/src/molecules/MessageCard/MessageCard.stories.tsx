import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MessageCard } from "./MessageCard.tsx";

const meta = {
  title: "Molecules/MessageCard",
  component: MessageCard,
  args: {
    icon: "users",
    tone: "danger",
    title: "You were removed from the meeting",
    body: "Omar Farooq removed you. If you join again, you'll wait in the lobby.",
    primary: { label: "Back to home", onClick: fn() },
  },
  decorators: [(Story) => <div className="max-w-80">{Story()}</div>],
} satisfies Meta<typeof MessageCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const EndForEveryone: Story = {
  args: {
    icon: "leave",
    title: "End the meeting for everyone?",
    body: "Everyone, including people in the lobby, will leave at once.",
    primary: { label: "End meeting", variant: "danger", onClick: fn() },
    secondary: { label: "Cancel", onClick: fn() },
  },
};
export const Warning: Story = {
  args: {
    icon: "clock",
    tone: "warning",
    title: "The meeting ends in 10 minutes",
    body: "Meetings last at most 30 hours. Start a new one to keep talking.",
    primary: { label: "OK, got it", onClick: fn() },
  },
};
export const Notice: Story = {
  args: {
    icon: "screen",
    tone: "neutral",
    title: "Your share ended",
    body: "Sara Malik started sharing, so your share stopped.",
    primary: undefined,
    live: "polite",
  },
};

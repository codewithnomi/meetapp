import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Notice } from "./Notice.tsx";

const meta = {
  title: "Molecules/Notice",
  component: Notice,
  args: { tone: "danger", children: "Email or password is wrong. Check both, or use a code instead." },
  decorators: [(Story) => <div className="max-w-95">{Story()}</div>],
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Neutral: Story = {
  args: { tone: "neutral", children: "You'll stay signed in here. Other devices will need the new password." },
};
export const WithAction: Story = {
  args: {
    icon: "signal",
    children: "Can't reach MeetApp. Check your connection.",
    action: { label: "Retry", onClick: fn() },
  },
};
export const Success: Story = {
  args: {
    tone: "success",
    title: "Request sent",
    children:
      "We'll tell you when the owner or an admin of Northwind partners approves it. Requests expire after 14 days.",
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RequestRow } from "./RequestRow.tsx";

const meta = {
  title: "Molecules/RequestRow",
  component: RequestRow,
  args: {
    leading: { person: "Zara Iqbal" },
    title: "Zara Iqbal",
    detail: "zara@aria.com · asked 2 hours ago with the join code",
    actions: [
      { label: "Reject", variant: "ghost", onClick: fn() },
      { label: "Approve", onClick: fn() },
    ],
  },
  decorators: [(Story) => <div className="max-w-180 rounded-lg border border-line bg-surface">{Story()}</div>],
} satisfies Meta<typeof RequestRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const RemovedEarlier: Story = {
  args: { leading: { person: "Kamran Butt" }, title: "Kamran Butt", badge: "Removed earlier" },
};
export const Busy: Story = { args: { busy: true } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const SentInvitation: Story = {
  args: {
    leading: { icon: "send" },
    title: "daniel@northwind.com",
    detail: "Invited as admin by Omar Sheikh · expires in 5 days",
    actions: [
      { label: "Cancel invitation", variant: "ghost", onClick: fn() },
      { label: "Send again", variant: "secondary", onClick: fn() },
    ],
  },
};
export const Invitation: Story = {
  args: {
    size: "lg",
    leading: { workspace: "Bayside clinics", tone: "accent" },
    title: "Bayside clinics",
    detail: "Omar Sheikh invited you as a member · expires in 6 days",
    actions: [
      { label: "Decline", variant: "ghost", onClick: fn() },
      { label: "Join", onClick: fn() },
    ],
  },
};

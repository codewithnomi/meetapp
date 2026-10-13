import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { InviteForm } from "./InviteForm.tsx";

const meta = {
  title: "Molecules/InviteForm",
  component: InviteForm,
  args: {
    value: "",
    onValueChange: fn(),
    role: "member",
    onRoleChange: fn(),
    canInviteAdmin: true,
    onSubmit: fn(),
    labels: {
      emails: "Email addresses",
      placeholder: "sara@aria.com, bilal@aria.com",
      hint: "They join as soon as they accept. Invitations last 7 days.",
      role: "Role",
      roles: { member: "Member", admin: "Admin" },
      submit: "Send invitations",
      pending: "Sending invitations",
    },
  },
  decorators: [(Story) => <div className="max-w-230 rounded-lg border border-line bg-surface p-5">{Story()}</div>],
} satisfies Meta<typeof InviteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const MemberView: Story = { args: { canInviteAdmin: false } };
export const Filled: Story = { args: { value: "sara@aria.com, bilal@aria.com", role: "admin" } };
export const WithError: Story = { args: { value: "sara@", error: "Check this address: sara@" } };
export const Loading: Story = { args: { value: "sara@aria.com", pending: true } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

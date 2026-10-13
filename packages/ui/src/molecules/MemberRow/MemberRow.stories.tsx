import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MemberRow } from "./MemberRow.tsx";

const meta = {
  title: "Molecules/MemberRow",
  component: MemberRow,
  args: {
    name: "Sara Malik",
    email: "sara@aria.com",
    roleLabel: "Member",
    joined: "3 Oct 2026",
    actionsLabel: "Actions for Sara Malik",
    actions: [
      { id: "promote", label: "Make admin", onSelect: fn() },
      { id: "transfer", label: "Hand over ownership", onSelect: fn() },
      { id: "remove", label: "Remove from workspace", danger: true, onSelect: fn() },
    ],
  },
  decorators: [
    (Story) => (
      <table className="w-full min-w-160 border-collapse rounded-lg bg-surface text-[14px] text-ink">
        <tbody>{Story()}</tbody>
      </table>
    ),
  ],
} satisfies Meta<typeof MemberRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Owner: Story = {
  args: { name: "Aisha Khan", email: "aisha@aria.com", roleLabel: "Owner", owner: true, youLabel: "You", actions: [] },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

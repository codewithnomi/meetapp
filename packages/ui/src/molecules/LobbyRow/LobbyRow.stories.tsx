import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { LobbyRow } from "./LobbyRow.tsx";

const meta = {
  title: "Molecules/LobbyRow",
  component: LobbyRow,
  args: {
    name: "Leo Martins (Guest)",
    admitText: "Admit",
    denyText: "Deny",
    admitLabel: "Admit Leo Martins (Guest)",
    denyLabel: "Deny Leo Martins (Guest)",
    onAdmit: fn(),
    onDeny: fn(),
  },
  decorators: [
    (Story) => <ul className="m-0 flex max-w-95 list-none flex-col rounded-md bg-warning-soft p-3">{Story()}</ul>,
  ],
} satisfies Meta<typeof LobbyRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { busy: true } };

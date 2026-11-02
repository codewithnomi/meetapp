import type { Meta, StoryObj } from "@storybook/react-vite";
import { OtherDeviceBar } from "./OtherDeviceBar.tsx";

const meta = {
  title: "Molecules/OtherDeviceBar",
  component: OtherDeviceBar,
  args: {
    label: "Call on another device",
    title: "You're in a call on another device",
    callTitle: "Release team",
    join: { label: "Join on this device", onClick: () => undefined },
    transfer: { label: "Transfer to this device", onClick: () => undefined },
  },
  decorators: [(Story) => <div className="bg-bg p-4">{Story()}</div>],
} satisfies Meta<typeof OtherDeviceBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Moving: Story = { args: { pendingText: "Moving the call…" } };
export const Failed: Story = {
  args: { error: { text: "Couldn't join the call.", retry: { label: "Retry", onClick: () => undefined } } },
};

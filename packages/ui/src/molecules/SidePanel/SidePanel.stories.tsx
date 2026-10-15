import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SidePanel } from "./SidePanel.tsx";

const meta = {
  title: "Molecules/SidePanel",
  component: SidePanel,
  args: {
    title: "Meeting info",
    closeLabel: "Close meeting info",
    onClose: fn(),
    children: <p className="m-0 text-ink-muted">The panel's content goes here.</p>,
  },
  decorators: [(Story) => <div className="flex bg-stage p-6">{Story()}</div>],
} satisfies Meta<typeof SidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

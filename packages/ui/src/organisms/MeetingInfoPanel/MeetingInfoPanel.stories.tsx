import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MeetingInfoPanel } from "./MeetingInfoPanel.tsx";

const meta = {
  title: "Organisms/MeetingInfoPanel",
  component: MeetingInfoPanel,
  args: {
    title: "Meeting info",
    closeLabel: "Close meeting info",
    onClose: fn(),
    link: { label: "Link", value: "https://meetapp.app/m/Vb3kQ9xLr2Tz8pNw4YcH1d", copyLabel: "Copy", onCopy: fn() },
    details: [
      { label: "Meeting ID", value: "284 615 903 172", mono: true },
      { label: "Passcode", value: "h3Tq9z", mono: true },
      { label: "Organizer", value: "Aisha Khan" },
      { label: "Workspace", value: "Aria" },
    ],
    copyAll: { label: "Copy all details", onClick: fn() },
    options: { label: "Meeting options", onClick: fn() },
  },
  decorators: [(Story) => <div className="flex bg-stage p-6">{Story()}</div>],
} satisfies Meta<typeof MeetingInfoPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Copied: Story = { args: { status: "Link copied" } };
/** What everyone else sees: no Meeting options. */
export const Participant: Story = { args: { options: undefined } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

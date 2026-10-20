import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ParticipantRow } from "./ParticipantRow.tsx";

const meta = {
  title: "Molecules/ParticipantRow",
  component: ParticipantRow,
  args: {
    name: "Mei Lin (External)",
    roleLabel: "Presenter",
    micOn: false,
    micLabel: "Muted",
    cameraOn: false,
    cameraLabel: "Camera off",
    actionsLabel: "Actions for Mei Lin (External)",
    actions: [
      { id: "mute", label: "Mute", onSelect: fn() },
      { id: "attendee", label: "Make an attendee", onSelect: fn() },
      { id: "pin", label: "Pin for me", onSelect: fn() },
      { id: "remove", label: "Remove from meeting", danger: true, onSelect: fn() },
    ],
  },
  decorators: [
    (Story) => <ul className="m-0 flex max-w-95 list-none flex-col gap-0.5 rounded-lg bg-surface p-4">{Story()}</ul>,
  ],
} satisfies Meta<typeof ParticipantRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const You: Story = {
  args: {
    name: "Aisha Khan (you)",
    roleLabel: "Organizer",
    micOn: true,
    micLabel: "Microphone on",
    cameraOn: true,
    cameraLabel: "Camera on",
    actions: [],
  },
};
export const Speaking: Story = {
  args: {
    name: "Bilal Ahmed",
    speaking: true,
    speakingLabel: "Bilal Ahmed, speaking",
    micOn: true,
    micLabel: "Microphone on",
    cameraOn: true,
    cameraLabel: "Camera on",
  },
};
export const HandRaised: Story = { args: { name: "Sara Malik", handLabel: "Hand raised" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

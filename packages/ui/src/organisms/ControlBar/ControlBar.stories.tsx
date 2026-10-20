import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ControlBar, type ControlBarProps } from "./ControlBar.tsx";

const REACTIONS = ["👍 Like", "❤️ Love", "👏 Applause", "😂 Laugh", "😮 Surprised"].map((label) => ({
  id: label,
  label,
  onSelect: fn(),
}));

const ARGS: ControlBarProps = {
  label: "Meeting controls",
  elapsed: "00:18:42",
  mic: { on: true, label: "Mute (⌘⇧M)", onToggle: fn() },
  camera: { on: true, label: "Turn camera off (⌘⇧O)", onToggle: fn() },
  share: { on: false, label: "Share screen", onToggle: fn() },
  hand: { on: false, label: "Raise your hand (⌘⇧K)", onToggle: fn() },
  reactions: { label: "React", actions: REACTIONS },
  more: { label: "More options", active: false, onClick: fn() },
  leave: {
    label: "Leave",
    onLeave: fn(),
    menu: { label: "More ways to leave", actions: [{ id: "end", label: "End meeting", danger: true, onSelect: fn() }] },
  },
  people: { label: "Participants, 23", count: 23, active: false, onClick: fn() },
  info: { label: "Meeting info", active: true, onClick: fn() },
};

const meta = {
  title: "Organisms/ControlBar",
  component: ControlBar,
  args: ARGS,
  decorators: [(Story) => <div className="bg-stage p-4">{Story()}</div>],
} satisfies Meta<typeof ControlBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const MutedCameraOffHandUp: Story = {
  args: {
    mic: { on: false, label: "Unmute (⌘⇧M)", onToggle: fn() },
    camera: { on: false, label: "Turn camera on (⌘⇧O)", onToggle: fn() },
    hand: { on: true, label: "Lower your hand (⌘⇧K)", onToggle: fn() },
    share: { on: true, label: "Stop sharing", onToggle: fn() },
  },
};
export const Attendee: Story = {
  args: {
    mic: { on: false, label: "Microphones are off for attendees", onToggle: fn(), disabled: true },
    share: { on: false, label: "Only presenters can share", onToggle: fn(), disabled: true },
    leave: { label: "Leave", onLeave: fn() },
    info: { label: "Meeting info", active: false, onClick: fn() },
  },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

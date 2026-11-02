import type { Meta, StoryObj } from "@storybook/react-vite";
import { RingWindow } from "./RingWindow.tsx";

const answer = (label: string, short: string) => ({ label, short, onClick: () => undefined });

const meta = {
  title: "Organisms/RingWindow",
  component: RingWindow,
  args: {
    label: "Incoming video call from Sara Malik",
    callerName: "Sara Malik",
    subtitle: "Video call",
    video: answer("Accept with video", "Video"),
    audio: answer("Accept with audio", "Audio"),
    decline: answer("Decline", "Decline"),
    hide: { label: "Hide (the call keeps ringing in MeetApp)", onClick: () => undefined },
  },
  // The real window is 360 × 200 points, 264 with the busy line.
  decorators: [(Story) => <div className="h-66 w-90">{Story()}</div>],
} satisfies Meta<typeof RingWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VideoCall: Story = {};
export const AudioCall: Story = {
  args: { label: "Incoming audio call from Omar Farooq", callerName: "Omar Farooq", subtitle: "Audio call" },
};
export const Group: Story = { args: { subtitle: "Video call · Release team" } };
export const DuringAnotherCall: Story = {
  args: {
    subtitle: "Video call · Release team",
    busyNote: "You're in Design review. Accepting leaves it.",
    video: answer("Leave current call and accept with video", "Video"),
    audio: answer("Leave current call and accept with audio", "Audio"),
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { IncomingCall } from "./IncomingCall.tsx";

const answer = (label: string, short: string) => ({ label, short, onClick: () => undefined });

const meta = {
  title: "Organisms/IncomingCall",
  component: IncomingCall,
  args: {
    label: "Incoming call",
    callerName: "Bilal Ahmed",
    subtitle: "Video call",
    video: answer("Accept with video", "Video"),
    audio: answer("Accept with audio", "Audio"),
    decline: answer("Decline", "Decline"),
  },
  decorators: [(Story) => <div className="bg-bg p-6">{Story()}</div>],
} satisfies Meta<typeof IncomingCall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneToOne: Story = {};
export const Group: Story = { args: { callerName: "Sara Malik", subtitle: "Video call · Release team" } };
export const DuringAnotherCall: Story = {
  args: {
    callerName: "Sara Malik",
    subtitle: "Audio call · Release team",
    busyNote: "You're in Design review: invite flow. Accepting leaves it.",
    video: answer("Leave current call and accept with video", "Video"),
    audio: answer("Leave current call and accept with audio", "Audio"),
  },
};

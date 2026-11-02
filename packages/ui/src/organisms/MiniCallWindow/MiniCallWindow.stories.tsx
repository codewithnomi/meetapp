import type { Meta, StoryObj } from "@storybook/react-vite";
import { MiniCallWindow } from "./MiniCallWindow.tsx";

const none = () => undefined;
/** A stand-in for a video picture from the main window (the real one is a blob: JPEG). */
const FRAME =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAAH0lEQVR4nGOIyuuhKWIYtWDUglELRi0YtWDUAnpYAAD0Iv0ffU2lUQAAAABJRU5ErkJggg==";

const meta = {
  title: "Organisms/MiniCallWindow",
  component: MiniCallWindow,
  args: {
    label: "Call: Release team",
    title: "Release team",
    details: "12:48 · 4 people",
    speakerName: "Sara Malik",
    caption: "Sara Malik is speaking",
    controls: true,
    controlsLabel: "Call controls",
    mic: { label: "Mute (⌘⇧M)", on: true, onClick: none },
    camera: { label: "Turn camera on (⌘⇧O)", on: false, onClick: none },
    share: { label: "Share screen", onClick: none },
    hand: { label: "Raise your hand (⌘⇧K)", on: false, onClick: none },
    leave: { label: "Leave", onClick: none },
    back: { label: "Back to the call window", onClick: none },
    hide: { label: "Hide (the call goes on in MeetApp)", onClick: none },
  },
  // The real window is 320 × 256 points.
  decorators: [(Story) => <div className="h-64 w-80">{Story()}</div>],
} satisfies Meta<typeof MiniCallWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

const picture = <img src={FRAME} alt="" />;

export const SpeakerVideo: Story = { args: { video: picture } };
export const CameraOff: Story = {};
export const Sharing: Story = { args: { video: picture, caption: "Sara Malik is sharing" } };
export const MutedByOrganizer: Story = {
  args: { mic: { label: "Your microphone is turned off by the organizer", on: false, onClick: none, disabled: true } },
};
export const Reconnecting: Story = { args: { caption: "Reconnecting…", controls: false } };
export const Lobby: Story = { args: { caption: "Waiting to be let in…", controls: false, details: "Lobby" } };
export const Calling: Story = {
  args: {
    title: "Sara Malik",
    caption: "Calling Sara Malik…",
    controls: false,
    details: "Ringing",
    leave: { label: "Cancel", onClick: none },
  },
};
export const Muted: Story = { args: { mic: { label: "Unmute (⌘⇧M)", on: false, onClick: none } } };
export const CameraOn: Story = {
  args: { video: picture, camera: { label: "Turn camera off (⌘⇧O)", on: true, onClick: none } },
};
export const HandRaised: Story = { args: { hand: { label: "Lower your hand (⌘⇧K)", on: true, onClick: none } } };

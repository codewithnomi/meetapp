import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VideoTile } from "./VideoTile.tsx";

/** Stands in for a live camera in the gallery (the app puts a real <video> here). */
const camera = (
  <div
    aria-hidden="true"
    className="size-full bg-[radial-gradient(120%_90%_at_50%_20%,var(--stage-tile),var(--stage))]"
  />
);

const meta = {
  title: "Organisms/VideoTile",
  component: VideoTile,
  args: { name: "Bilal Ahmed", video: camera },
  decorators: [(Story) => <div className="max-w-110 bg-stage p-4">{Story()}</div>],
} satisfies Meta<typeof VideoTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Speaking: Story = { args: { speakingText: "Speaking" } };
export const CameraOff: Story = {
  args: { name: "Aisha Khan (you)", roleLabel: "Organizer", cameraOff: true, mutedLabel: "Muted" },
};
export const HandRaised: Story = {
  args: { name: "Sara Malik", handText: "Hand raised", mutedLabel: "Muted", weakText: "Weak connection" },
};
export const Reaction: Story = { args: { name: "Omar Farooq", reaction: { emoji: "👏", text: "Omar Farooq" } } };
export const Pinned: Story = {
  args: { speakingText: "Speaking", pinned: { text: "Pinned for you", unpinLabel: "Unpin", onUnpin: fn() } },
};
export const Focused: Story = {
  args: { pinned: { text: "Pinned for you", unpinLabel: "Unpin", onUnpin: fn() } },
  parameters: { pseudo: { focusVisible: true } },
};

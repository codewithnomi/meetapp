import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ConversationHeader } from "./ConversationHeader.tsx";

const meta = {
  title: "Organisms/ConversationHeader",
  component: ConversationHeader,
  args: {
    kind: "direct",
    title: "Bilal Ahmed",
    status: { value: "available", label: "Available" },
    subtitle: "Available",
    calls: { videoLabel: "Video call", audioLabel: "Audio call", onVideo: fn(), onAudio: fn() },
    moreLabel: "More for this chat",
    actions: [
      { id: "pin", label: "Pin", onSelect: fn() },
      { id: "mute", label: "Mute", onSelect: fn() },
      { id: "hide", label: "Hide", onSelect: fn() },
    ],
  },
  decorators: [(Story) => <div className="w-200">{Story()}</div>],
} satisfies Meta<typeof ConversationHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Person: Story = {};
export const Group: Story = { args: { kind: "group", title: "Release team", status: null, subtitle: "6 people" } };
export const Meeting: Story = {
  args: { kind: "meeting", title: "Weekly design review", status: null, subtitle: "Mon 10:00" },
};
export const CallsUnavailable: Story = {
  args: {
    calls: {
      videoLabel: "Video call",
      audioLabel: "Audio call",
      onVideo: fn(),
      onAudio: fn(),
      disabled: true,
      disabledReason: "You can call once they accept your chat request.",
    },
  },
};
export const CallRunning: Story = {
  args: {
    kind: "group",
    title: "Release team",
    status: null,
    subtitle: "6 people",
    calls: {
      videoLabel: "Video call",
      audioLabel: "Audio call",
      onVideo: fn(),
      onAudio: fn(),
      join: { label: "Join", onJoin: fn() },
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SmallCallView } from "./SmallCallView.tsx";

const none = () => undefined;

const meta = {
  title: "Organisms/SmallCallView",
  component: SmallCallView,
  args: {
    label: "Call: Release team",
    title: "Release team",
    elapsed: "12:40",
    speakerName: "Sara Malik",
    caption: "Sara Malik is talking",
    controls: true,
    controlsLabel: "Call controls",
    mic: { label: "Mute (⌘⇧M)", on: true, onClick: none },
    camera: { label: "Turn camera on (⌘⇧O)", on: false, onClick: none },
    leave: { label: "Leave the call", text: "Leave", onClick: none },
    back: { label: "Go back to the Release team call", text: "Go back", onClick: none },
  },
} satisfies Meta<typeof SmallCallView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Hover: Story = { parameters: { pseudo: { hover: ["button"] } } };

export const Focused: Story = { parameters: { pseudo: { focusVisible: ["button"] } } };

export const Sharing: Story = { args: { sharing: "You're sharing" } };

export const Muted: Story = {
  args: { mic: { label: "Your microphone is off", on: false, onClick: none, disabled: true } },
};

export const Disabled: Story = Muted;

export const Lobby: Story = {
  args: { controls: false, caption: "Waiting to be let in…", captionIsStatus: true },
};

export const Calling: Story = {
  args: {
    controls: false,
    caption: "Calling Omar Farooq…",
    captionIsStatus: true,
    leave: { label: "Cancel the call", text: "Cancel", onClick: none },
  },
};

export const Reconnecting: Story = {
  args: { controls: false, caption: "Reconnecting…", captionIsStatus: true },
};

export const LongNames: Story = {
  args: {
    title: "Quarterly planning with the whole product and design organisation",
    caption: "Maximilian Alexander Featherstonehaugh is talking",
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { IconButton } from "./IconButton.tsx";

const meta = {
  title: "Atoms/IconButton",
  component: IconButton,
  args: { icon: "mic", label: "Mute", onClick: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Active: Story = { args: { icon: "screen", label: "Stop sharing", active: true } };
export const Off: Story = { args: { icon: "mic-off", label: "Unmute", off: true } };
export const Ghost: Story = { args: { icon: "chat", label: "Chat", variant: "ghost" } };
export const WithBadge: Story = { args: { icon: "users", label: "Participants", variant: "ghost", badge: 12 } };
export const Small: Story = { args: { icon: "more", label: "More options", size: "sm" } };
export const TooltipShown: Story = {
  args: { icon: "hand", label: "Raise hand" },
  parameters: { pseudo: { focusVisible: true } },
  play: async ({ canvas }) => {
    canvas.getByRole("button", { name: "Raise hand" }).focus();
  },
};
export const ControlWithBadge: Story = { args: { icon: "chat", label: "Chat, 3 unread", badge: 3 } };
export const ActiveHover: Story = {
  args: { icon: "screen", label: "Stop sharing", active: true },
  parameters: { pseudo: { hover: true } },
};
export const OffHover: Story = {
  args: { icon: "mic-off", label: "Unmute", off: true },
  parameters: { pseudo: { hover: true } },
};
export const DisabledActive: Story = {
  args: { icon: "captions", label: "Hide captions", active: true, disabled: true },
};

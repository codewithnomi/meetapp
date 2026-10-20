import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ActionMenu } from "./ActionMenu.tsx";

const meta = {
  title: "Atoms/ActionMenu",
  component: ActionMenu,
  args: {
    label: "Actions for Mei Lin (External)",
    actions: [
      { id: "mute", label: "Mute", onSelect: fn() },
      { id: "attendee", label: "Make an attendee", onSelect: fn() },
      { id: "pin", label: "Pin for me", onSelect: fn() },
      { id: "remove", label: "Remove from meeting", danger: true, onSelect: fn() },
    ],
  },
} satisfies Meta<typeof ActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
/** The menu open, as in the approved "Meeting: speaker view" screen. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  },
};

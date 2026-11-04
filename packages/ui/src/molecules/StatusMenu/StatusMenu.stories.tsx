import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { StatusMenu } from "./StatusMenu.tsx";

const meta = {
  title: "Molecules/StatusMenu",
  component: StatusMenu,
  args: {
    name: "Olivia Owner",
    email: "owner@example.test",
    status: "dnd",
    chosen: "dnd",
    duration: "30m",
    until: "Until 11:30",
    statusLabels: {
      available: "Available",
      busy: "Busy",
      dnd: "Do not disturb",
      brb: "Be right back",
      away: "Appear away",
      in_call: "In a call",
      offline: "Offline",
    },
    durationLabels: {
      "30m": "30 minutes",
      "1h": "1 hour",
      "2h": "2 hours",
      today: "Today",
      week: "This week",
      forever: "Until I change it",
    },
    words: { menu: "Your account", forHowLong: "For how long", reset: "Reset status" },
    actions: [
      { id: "settings", label: "Settings", onSelect: fn() },
      { id: "out", label: "Sign out", onSelect: fn() },
    ],
    onChoose: fn(),
    onReset: fn(),
  },
} satisfies Meta<typeof StatusMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DoNotDisturb: Story = {};
export const Automatic: Story = { args: { status: "available", chosen: null, until: null, duration: "forever" } };
export const InACall: Story = { args: { status: "in_call", chosen: null, until: null, duration: "forever" } };
/** The menu open, as on the approved canvas. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  },
};

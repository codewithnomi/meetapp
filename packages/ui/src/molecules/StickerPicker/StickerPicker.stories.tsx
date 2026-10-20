import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { StickerPicker } from "./StickerPicker.tsx";

const words = ["Thank you", "Great job", "On my way", "Be right back", "Agreed", "Coffee?", "Ship it", "Welcome"];
const names = ["thank-you", "great-job", "on-my-way", "be-right-back", "agreed", "coffee", "ship-it", "welcome"];

const meta = {
  title: "Molecules/StickerPicker",
  component: StickerPicker,
  args: {
    label: "Stickers",
    stickers: names.map((name, i) => ({ name, text: words[i] ?? name, label: `Sticker: ${words[i] ?? name}` })),
    onPick: fn(),
  },
  decorators: [(Story) => <div className="max-w-90 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof StickerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

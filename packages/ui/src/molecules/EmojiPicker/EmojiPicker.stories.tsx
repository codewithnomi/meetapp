import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { EmojiPicker } from "./EmojiPicker.tsx";

const meta = {
  title: "Molecules/EmojiPicker",
  component: EmojiPicker,
  args: {
    dataUrl: "/emojibase",
    onPick: fn(),
    recent: ["👍", "🎉", "😂", "🙏"],
    labels: {
      search: "Search emoji",
      recent: "Recently used",
      loading: "Loading…",
      empty: "No emoji found",
      skinTone: "Skin tone",
    },
  },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const NoRecent: Story = { args: { recent: [] } };

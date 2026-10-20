import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sticker } from "./Sticker.tsx";

const meta = {
  title: "Atoms/Sticker",
  component: Sticker,
  args: { name: "thank-you", text: "Thank you", label: "Sticker: Thank you" },
} satisfies Meta<typeof Sticker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Small: Story = { args: { size: "sm", name: "ship-it", text: "Ship it", label: "Sticker: Ship it" } };

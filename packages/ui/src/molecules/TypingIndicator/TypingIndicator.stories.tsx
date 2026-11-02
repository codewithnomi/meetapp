import type { Meta, StoryObj } from "@storybook/react-vite";
import { TypingIndicator } from "./TypingIndicator.tsx";

const meta = {
  title: "Molecules/TypingIndicator",
  component: TypingIndicator,
  args: { text: "Bilal is typing…" },
} satisfies Meta<typeof TypingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnePerson: Story = {};
export const TwoPeople: Story = { args: { text: "Bilal and Sara are typing…" } };
export const Nobody: Story = { args: { text: "" } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReactionChip } from "./ReactionChip.tsx";

const meta = {
  title: "Atoms/ReactionChip",
  component: ReactionChip,
  args: { emoji: "👍", count: 3, mine: false, label: "Thumbs up, 3 people", onClick: fn() },
} satisfies Meta<typeof ReactionChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Mine: Story = { args: { mine: true, count: 4, label: "Thumbs up, 4 people, including you" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true } };

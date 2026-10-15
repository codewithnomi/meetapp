import type { Meta, StoryObj } from "@storybook/react-vite";
import { LevelMeter } from "./LevelMeter.tsx";

const meta = {
  title: "Atoms/LevelMeter",
  component: LevelMeter,
  args: { label: "Microphone level", level: 4 },
} satisfies Meta<typeof LevelMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Silent: Story = { args: { level: 0 } };
export const Loud: Story = { args: { level: 10 } };

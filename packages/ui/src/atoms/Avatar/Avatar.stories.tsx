import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar.tsx";

const meta = {
  title: "Atoms/Avatar",
  component: Avatar,
  args: { name: "Aisha Khan" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Speaking: Story = { args: { speaking: true, speakingLabel: "Aisha Khan, speaking" } };
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
      <Avatar {...args} size="xl" />
    </div>
  ),
};
export const OneName: Story = { args: { name: "Ravi" } };

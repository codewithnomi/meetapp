import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./Spinner.tsx";

const meta = {
  title: "Atoms/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const WithLabel: Story = { args: { label: "Connecting to the meeting" } };
export const Large: Story = { args: { size: 32, className: "text-accent-text" } };

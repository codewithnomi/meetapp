import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge.tsx";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "Guest" },
  argTypes: { tone: { control: "inline-radio", options: ["neutral", "accent", "success", "warning", "danger"] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Accent: Story = { args: { tone: "accent", children: "Host" } };
export const Success: Story = { args: { tone: "success", children: "Connected" } };
export const Warning: Story = { args: { tone: "warning", children: "Weak connection", icon: "signal" } };
export const Danger: Story = { args: { tone: "danger", children: "Transcribing", icon: "captions" } };

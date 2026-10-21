import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FileChip } from "./FileChip.tsx";

const meta = {
  title: "Atoms/FileChip",
  component: FileChip,
  args: {
    text: "Invite flow test plan.pdf · 1.4 MB",
    state: "ready",
    removeLabel: "Remove Invite flow test plan.pdf",
    onRemove: fn(),
  },
} satisfies Meta<typeof FileChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Uploading: Story = {
  args: { text: "screen.png · 62%", state: "uploading", uploadingLabel: "Uploading screen.png" },
};
export const Failed: Story = {
  args: {
    text: "roadmap.xlsx",
    state: "failed",
    failed: { label: "Upload failed", retryLabel: "Retry", onRetry: fn() },
  },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

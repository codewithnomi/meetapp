import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SAMPLE_POLL_LABELS } from "./labels.ts";
import { PollCreator } from "./PollCreator.tsx";

const meta = {
  title: "Organisms/PollCreator",
  component: PollCreator,
  args: { open: true, onOpenChange: fn(), onPost: fn(), labels: SAMPLE_POLL_LABELS },
} satisfies Meta<typeof PollCreator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Busy: Story = { args: { busy: true } };

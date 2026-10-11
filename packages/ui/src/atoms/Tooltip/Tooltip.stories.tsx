import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "../IconButton/index.ts";
import { Tooltip } from "./Tooltip.tsx";

const meta = {
  title: "Atoms/Tooltip",
  component: Tooltip,
  // A tooltip names an icon-only button; it never adds information found nowhere else.
  args: { label: "Copy invite link", children: <IconButton icon="copy" label="Copy invite link" tooltip={false} /> },
  decorators: [
    (Story) => (
      <div className="flex min-h-40 items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Open: Story = { args: { open: true } };
export const Bottom: Story = { args: { open: true, side: "bottom" } };

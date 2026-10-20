import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropArea } from "./DropArea.tsx";

const meta = {
  title: "Molecules/DropArea",
  component: DropArea,
  args: {
    title: "Drop files to share in chat",
    hint: "Pictures, PDF, text, CSV, Word, Excel, PowerPoint · up to 25 MB each",
  },
  decorators: [(Story) => <div className="relative h-105 max-w-110 rounded-lg bg-surface-sunken">{Story()}</div>],
} satisfies Meta<typeof DropArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SystemNote } from "./SystemNote.tsx";

const meta = {
  title: "Molecules/SystemNote",
  component: SystemNote,
  args: { text: "Aisha Khan pinned a message" },
  decorators: [(Story) => <div className="flex flex-col bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof SystemNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const ChatOff: Story = { args: { text: "Aisha Khan turned chat off" } };

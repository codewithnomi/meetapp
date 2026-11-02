import type { Meta, StoryObj } from "@storybook/react-vite";
import { SeenMark } from "./SeenMark.tsx";

const meta = {
  title: "Molecules/SeenMark",
  component: SeenMark,
  args: { label: "Seen" },
  decorators: [(Story) => <div className="flex w-80 flex-col p-6">{Story()}</div>],
} satisfies Meta<typeof SeenMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneToOne: Story = {};
export const Group: Story = { args: { seenBy: "Seen by Sara Malik, Omar Farooq" } };

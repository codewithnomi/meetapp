import type { Meta, StoryObj } from "@storybook/react-vite";
import { CallNote } from "./CallNote.tsx";

const meta = {
  title: "Molecules/CallNote",
  component: CallNote,
  args: {
    kind: "running",
    text: "Sara Malik started a call",
    detail: "03:12 · 2 people",
    action: { label: "Join", onClick: () => undefined },
  },
  decorators: [(Story) => <div className="flex flex-col bg-bg p-4">{Story()}</div>],
} satisfies Meta<typeof CallNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};
export const Ended: Story = {
  args: { kind: "ended", text: "Call ended", detail: "1h 05m · Sara Malik, Omar Farooq and you", action: undefined },
};
export const Missed: Story = {
  args: {
    kind: "missed",
    text: "Missed call from Omar Farooq",
    detail: "17:42",
    action: { label: "Call back", onClick: () => undefined },
  },
};

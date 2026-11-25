import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MeetingListDialog } from "./MeetingListDialog.tsx";

const meta = {
  title: "Organisms/MeetingListDialog",
  component: MeetingListDialog,
  args: {
    title: "More meetings",
    closeLabel: "Close",
    meetings: [
      { id: "1", title: "Customer call", time: "14:00 – 15:00", state: "accepted", stateLabel: "Olivia Owner" },
      { id: "2", title: "Retro", time: "16:00 – 16:30", state: "tentative", stateLabel: "Mo Member", repeats: true },
      { id: "3", title: "Hiring sync", time: "17:00 – 17:30", state: "declined", stateLabel: "Sara Malik" },
    ],
    onOpen: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof MeetingListDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

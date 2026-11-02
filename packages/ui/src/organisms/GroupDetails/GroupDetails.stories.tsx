import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { GroupDetails } from "./GroupDetails.tsx";

const meta = {
  title: "Organisms/GroupDetails",
  component: GroupDetails,
  args: {
    title: "Release team",
    closeLabel: "Close group details",
    onClose: fn(),
    nameLabel: "Group name",
    name: "Release team",
    onRename: fn(),
    peopleHeading: "People (4)",
    addLabel: "Add people",
    onAdd: fn(),
    people: [
      { id: "a", name: "Aisha Khan (you)", status: { value: "available", label: "Available" } },
      {
        id: "b",
        name: "Bilal Ahmed",
        status: { value: "in_call", label: "In a call" },
        removeLabel: "Remove Bilal Ahmed from the group",
      },
      {
        id: "o",
        name: "Omar Farooq",
        status: { value: "away", label: "Away" },
        removeLabel: "Remove Omar Farooq from the group",
      },
      {
        id: "m",
        name: "Mei Lin",
        externalLabel: "(External)",
        status: { value: "offline", label: "Offline" },
        removeLabel: "Remove Mei Lin from the group",
      },
    ],
    onRemove: fn(),
    leaveLabel: "Leave group",
    onLeave: fn(),
  },
  decorators: [(Story) => <div className="w-130 bg-bg p-6">{Story()}</div>],
} satisfies Meta<typeof GroupDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const NameTooLong: Story = { args: { nameError: "Use 1 to 80 characters" } };

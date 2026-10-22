import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PeoplePicker } from "./PeoplePicker.tsx";

const meta = {
  title: "Molecules/PeoplePicker",
  component: PeoplePicker,
  args: {
    label: "To:",
    hint: "Type a name from Aria, or anyone's email.",
    picked: [{ id: "s", name: "Sara Malik", removeLabel: "Remove Sara Malik" }],
    query: "bil",
    onQueryChange: fn(),
    suggestions: [
      { id: "b", name: "Bilal Ahmed", detail: "Available", status: { value: "available", label: "Available" } },
      { id: "h", name: "Bilal Hussain", detail: "Offline", status: { value: "offline", label: "Offline" } },
    ],
    suggestionsLabel: "Suggestions",
    onPick: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <div className="w-150 bg-surface p-6">{Story()}</div>],
} satisfies Meta<typeof PeoplePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggestions: Story = {};
export const Chips: Story = {
  args: {
    query: "",
    suggestions: [],
    picked: [
      { id: "s", name: "Sara Malik", removeLabel: "Remove Sara Malik" },
      { id: "o", name: "Omar Farooq", removeLabel: "Remove Omar Farooq" },
    ],
  },
};
export const External: Story = {
  args: {
    query: "mei.lin@northwind.com",
    suggestions: [
      {
        id: "m",
        name: "mei.lin@northwind.com",
        externalLabel: "(External)",
        detail: "Not in Aria · they'll get a chat request first",
      },
    ],
  },
};
export const NoAccount: Story = {
  args: {
    query: "sam@contoso.com",
    suggestions: [],
    noAccount: {
      email: "sam@contoso.com",
      message: "No one with this email uses MeetApp yet. Invite them to Aria by email; you can chat once they join.",
      inviteLabel: "Invite sam@contoso.com",
      onInvite: fn(),
    },
  },
};

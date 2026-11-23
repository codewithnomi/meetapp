import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MeetingDetailsPanel } from "./MeetingDetailsPanel.tsx";
import { detailsExample, type Answer } from "./fixtures.ts";

const meta = {
  title: "Organisms/MeetingDetailsPanel",
  component: MeetingDetailsPanel<Answer>,
  args: detailsExample(fn()),
  decorators: [(Story) => <div className="flex h-200 bg-bg p-6">{Story()}</div>],
} satisfies Meta<typeof MeetingDetailsPanel<Answer>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Organizer: Story = {};
export const Invited: Story = { args: { edit: undefined, cancel: undefined, details: [] } };
export const NotYetJoinable: Story = { args: { join: undefined } };
export const UnsentInvites: Story = {
  args: { unsent: { text: "1 invite couldn't be sent.", retry: { label: "Retry", onClick: fn() } } },
};
export const Cancelled: Story = { args: { cancelledNote: "This meeting was cancelled." } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

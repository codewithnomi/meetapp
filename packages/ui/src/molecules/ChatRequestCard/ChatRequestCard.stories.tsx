import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatRequestCard } from "./ChatRequestCard.tsx";

const meta = {
  title: "Molecules/ChatRequestCard",
  component: ChatRequestCard,
  args: {
    name: "Daniel Cho",
    externalLabel: "(External)",
    intro: "daniel.cho@fabrikam.com wants to chat with you",
    previewLabel: "Preview messages",
    previewListLabel: "Preview of messages",
    onPreview: fn(),
    explanation:
      "Accept to chat and share your status. Delete removes the request; Daniel isn't told and can't ask again for 30 days.",
    acceptLabel: "Accept",
    deleteLabel: "Delete",
    onAccept: fn(),
    confirm: {
      title: "Delete this chat request?",
      alsoBlockLabel: "Also block Daniel Cho (he can't message you or see your status)",
      cancelLabel: "Cancel",
      deleteLabel: "Delete",
    },
    onDelete: fn(),
  },
  decorators: [(Story) => <div className="max-w-160 bg-bg p-6">{Story()}</div>],
} satisfies Meta<typeof ChatRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BeforePreview: Story = {};
export const WithPreview: Story = {
  args: {
    preview: [
      { id: "1", senderName: "Daniel Cho", text: "Hi Aisha, we met at the design meetup last week.", time: "09:30" },
      { id: "2", senderName: "Daniel Cho", text: "Could we talk about the invite flow you showed?", time: "09:31" },
    ],
  },
};

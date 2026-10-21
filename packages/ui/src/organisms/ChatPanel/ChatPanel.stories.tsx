import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatPanel } from "./ChatPanel.tsx";

const meta = {
  title: "Organisms/ChatPanel",
  component: ChatPanel,
  args: {
    title: "Chat",
    closeLabel: "Close chat",
    onClose: fn(),
    listLabel: "Messages",
    messages: (
      <>
        <p className="m-0 text-ink">Bilal Ahmed: Can someone share the staging link?</p>
        <p className="m-0 text-ink">You: staging.aria.dev/payments</p>
      </>
    ),
    composer: (
      <div className="rounded-lg border border-line-strong bg-surface-sunken p-3 text-ink-muted">Message everyone</div>
    ),
  },
  decorators: [(Story) => <div className="flex h-150 max-w-110 flex-col">{Story()}</div>],
} satisfies Meta<typeof ChatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Empty: Story = {
  args: { empty: { title: "No messages yet", hint: "Messages here are seen by everyone in the meeting." } },
};
export const Pinned: Story = {
  args: { pinned: { title: "Pinned", text: "Bilal Ahmed: Release checklist", position: "1 of 2", onShow: fn() } },
};
export const NewMessages: Story = { args: { newMessages: { label: "New messages", onClick: fn() } } };
export const ChatOff: Story = {
  args: {
    composer: undefined,
    notice: (
      <p className="m-0 rounded-md bg-surface-sunken p-3 text-[13px] text-ink">
        Chat is turned off for this meeting. You can still read earlier messages.
      </p>
    ),
  },
};
export const Dropping: Story = {
  args: {
    dropArea: {
      title: "Drop files to share in chat",
      hint: "Pictures, PDF, text, CSV, Word, Excel, PowerPoint · up to 25 MB each",
    },
  },
};

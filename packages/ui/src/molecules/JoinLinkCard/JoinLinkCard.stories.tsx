import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { JoinLinkCard } from "./JoinLinkCard.tsx";

const meta = {
  title: "Molecules/JoinLinkCard",
  component: JoinLinkCard,
  args: {
    enabled: true,
    link: "https://meetapp.app/join/k3v9wq2mxr7tQ1aZ8pLmN0bC",
    code: "AR4N7QXDKM",
    canManage: true,
    onToggle: fn(),
    onReplace: fn(),
    onCopy: fn(() => Promise.resolve()),
    labels: {
      title: "Join link and code",
      description: "Anyone signed in who has them can ask to join. You or an admin approves each request.",
      copyLink: "Copy link",
      copyCode: "Copy code",
      copied: "Copied",
      copyFailed: "Couldn't copy. Select the text and copy it yourself.",
      replace: "Replace link and code",
      off: "The join link is off. The owner or an admin can turn it on.",
    },
  },
  decorators: [(Story) => <div className="max-w-230 rounded-lg border border-line bg-surface p-5">{Story()}</div>],
} satisfies Meta<typeof JoinLinkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Off: Story = { args: { enabled: false, link: null, code: null } };
export const MemberView: Story = { args: { canManage: false } };
export const MemberViewOff: Story = { args: { canManage: false, enabled: false, link: null, code: null } };
export const Busy: Story = { args: { busy: true } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

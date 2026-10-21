import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AttachmentCard } from "./AttachmentCard.tsx";

const PIXEL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='130'><rect width='220' height='130' fill='gray'/></svg>";

const meta = {
  title: "Molecules/AttachmentCard",
  component: AttachmentCard,
  args: { fileName: "Invite flow test plan.pdf", details: "PDF · 1.4 MB", downloadLabel: "Download", onDownload: fn() },
  decorators: [(Story) => <div className="bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof AttachmentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Picture: Story = {
  args: {
    fileName: "new-invite-screen.png",
    details: "PNG · 220 KB",
    previewUrl: PIXEL,
    previewLabel: "Picture: new-invite-screen.png, open larger",
    onOpenPreview: fn(),
  },
};
export const LongName: Story = { args: { fileName: "a very long file name ".repeat(5) + ".pdf" } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

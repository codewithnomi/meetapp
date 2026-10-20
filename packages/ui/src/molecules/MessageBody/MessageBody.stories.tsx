import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MessageBody } from "./MessageBody.tsx";

const meta = {
  title: "Molecules/MessageBody",
  component: MessageBody,
  args: {
    onOpenLink: fn(),
    onCopyCode: fn(),
    copyLabel: "Copy",
    document: {
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Release checklist for Thursday", marks: [{ type: "bold" }] }],
        },
        {
          type: "orderedList",
          items: [
            { content: [{ type: "paragraph", content: [{ type: "text", text: "QA signs off the invite flow" }] }] },
            {
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Update the " },
                    { type: "text", text: "help page", marks: [{ type: "italic" }] },
                  ],
                },
              ],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Notes: https://example.com/notes" }] },
      ],
    },
  },
  decorators: [(Story) => <div className="max-w-90 rounded-md bg-surface-sunken p-3 text-ink">{Story()}</div>],
} satisfies Meta<typeof MessageBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Code: Story = {
  args: {
    document: {
      v: 1,
      blocks: [
        { type: "paragraph", content: [{ type: "text", text: "The invite link check:" }] },
        { type: "codeBlock", text: 'const ok = isMeetingLink(url)\n  && url.startsWith("https://meetapp.app/m/");' },
      ],
    },
  },
};
export const Quote: Story = {
  args: {
    document: {
      v: 1,
      blocks: [
        { type: "quote", content: [{ type: "paragraph", content: [{ type: "text", text: "Ship it on Thursday." }] }] },
      ],
    },
  },
};
export const HtmlStaysText: Story = {
  args: {
    document: {
      v: 1,
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "<b>not bold</b><script>alert(1)</script>" }] }],
    },
  },
};
export const LongText: Story = {
  args: {
    document: {
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "word ".repeat(80) + "https://example.com/" + "a".repeat(80) }],
        },
      ],
    },
  },
};

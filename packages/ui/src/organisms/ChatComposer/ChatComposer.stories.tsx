import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChatComposer } from "./ChatComposer.tsx";
import { SAMPLE_EMOJI, SAMPLE_LABELS } from "./labels.ts";

const meta = {
  title: "Organisms/ChatComposer",
  component: ChatComposer,
  args: {
    labels: SAMPLE_LABELS,
    tooManyLabel: (over: number) => `${String(over)} characters too many`,
    onSend: fn(),
    emoji: SAMPLE_EMOJI,
  },
  decorators: [(Story) => <div className="max-w-110 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const WithTools: Story = {
  args: { tools: <span className="text-[12px] text-ink-muted">attach · GIF · sticker · poll</span> },
};
export const Replying: Story = {
  args: { above: <div className="text-[12px] text-ink-muted">Replying to Bilal Ahmed</div> },
};

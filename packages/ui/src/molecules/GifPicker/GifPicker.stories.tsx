import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { GifPicker } from "./GifPicker.tsx";

const PIXEL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='96'><rect width='120' height='96' fill='gray'/></svg>";
const labels = {
  search: "Search GIFs",
  loading: "Searching…",
  unavailable: "GIFs aren't available right now. Try again later.",
  attribution: "Powered by KLIPY",
};

const meta = {
  title: "Molecules/GifPicker",
  component: GifPicker,
  args: {
    query: "thank you",
    onQuery: fn(),
    status: "ready",
    reduceMotion: false,
    onPick: fn(),
    labels,
    results: Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      url: PIXEL,
      description: `GIF: thank you ${String(i)}`,
      width: 120,
      height: 96,
    })),
  },
  decorators: [(Story) => <div className="max-w-100 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof GifPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const FirstTime: Story = {
  args: {
    notice: {
      text: "What you type here is sent to our GIF service to find GIFs. Your name and the meeting are not.",
      gotIt: "Got it",
      onGotIt: fn(),
    },
  },
};
export const Loading: Story = { args: { status: "loading", results: [] } };
export const Unavailable: Story = { args: { status: "unavailable", results: [] } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GifImage } from "./GifImage.tsx";

const PIXEL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'><rect width='200' height='150' fill='gray'/></svg>";

const meta = {
  title: "Molecules/GifImage",
  component: GifImage,
  args: {
    url: PIXEL,
    stillUrl: PIXEL,
    description: "GIF: thank you, waving cat",
    width: 200,
    height: 150,
    reduceMotion: false,
    labels: { pause: "Pause GIF", play: "Play GIF", attribution: "Powered by KLIPY" },
  },
  decorators: [(Story) => <div className="bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof GifImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const ReducedMotion: Story = { args: { reduceMotion: true } };

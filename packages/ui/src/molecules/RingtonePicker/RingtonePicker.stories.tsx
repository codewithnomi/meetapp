import type { Meta, StoryObj } from "@storybook/react-vite";
import { RingtonePicker } from "./RingtonePicker.tsx";

const tones = [
  ["Bright", "Clear and short, the default"],
  ["Chime", "Soft bells"],
  ["Pulse", "Low and steady"],
  ["Classic", "A familiar phone ring"],
  ["Gentle", "Quiet, for shared rooms"],
];

const meta = {
  title: "Molecules/RingtonePicker",
  component: RingtonePicker,
  args: {
    legend: "Ringtone",
    options: tones.map(([name = "", hint = ""], i) => ({ id: i + 1, name, hint, playLabel: `Play ${name}` })),
    value: 1,
    onChange: () => undefined,
    onPlay: () => undefined,
    volumeLabel: "Ringtone volume",
    volume: 70,
    onVolume: () => undefined,
  },
  decorators: [(Story) => <div className="bg-bg p-4">{Story()}</div>],
} satisfies Meta<typeof RingtonePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const ChimeChosen: Story = { args: { value: 2, volume: 40 } };

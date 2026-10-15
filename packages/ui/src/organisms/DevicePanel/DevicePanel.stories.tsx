import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DevicePanel } from "./DevicePanel.tsx";

const meta = {
  title: "Organisms/DevicePanel",
  component: DevicePanel,
  args: {
    title: "Device settings",
    closeLabel: "Close device settings",
    onClose: fn(),
    camera: {
      label: "Camera",
      value: "facetime",
      options: [
        { value: "facetime", label: "FaceTime HD Camera" },
        { value: "studio", label: "Studio Display Camera" },
      ],
      onChange: fn(),
    },
    microphone: {
      label: "Microphone",
      value: "built-in",
      options: [
        { value: "built-in", label: "MacBook Pro Microphone" },
        { value: "airpods", label: "AirPods Pro" },
      ],
      onChange: fn(),
      level: 4,
      levelLabel: "Microphone level",
    },
    speakers: {
      label: "Speakers",
      value: "built-in",
      options: [{ value: "built-in", label: "MacBook Pro Speakers" }],
      onChange: fn(),
      test: { label: "Test speakers", onClick: fn() },
    },
    noiseSuppression: {
      label: "Noise suppression",
      description: "Cuts background noise like typing and fans.",
      checked: true,
      onChange: fn(),
    },
  },
  decorators: [(Story) => <div className="flex bg-stage p-6">{Story()}</div>],
} satisfies Meta<typeof DevicePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const WeakConnection: Story = {
  args: { note: { title: "Your connection is weak.", text: "Others may see you in lower quality." } },
};
export const NoCamera: Story = {
  args: { camera: { label: "Camera", value: "", options: [], emptyLabel: "No camera found", onChange: fn() } },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

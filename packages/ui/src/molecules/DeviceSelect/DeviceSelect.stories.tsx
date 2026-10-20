import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { LevelMeter } from "../../atoms/LevelMeter/index.ts";
import { DeviceSelect } from "./DeviceSelect.tsx";

const meta = {
  title: "Molecules/DeviceSelect",
  component: DeviceSelect,
  args: {
    label: "Microphone",
    value: "built-in",
    options: [
      { value: "built-in", label: "MacBook Pro Microphone" },
      { value: "airpods", label: "AirPods Pro" },
    ],
    onChange: fn(),
  },
  decorators: [(Story) => <div className="max-w-90">{Story()}</div>],
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <DeviceSelect
        {...args}
        onChange={(value) => {
          args.onChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
} satisfies Meta<typeof DeviceSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const NoDevice: Story = { args: { label: "Camera", options: [], emptyLabel: "No camera found" } };
export const WithLevel: Story = {
  args: { children: <LevelMeter label="Microphone level" level={4} className="pl-3.5" /> },
};
export const WithHint: Story = {
  args: {
    label: "Who can skip the lobby?",
    value: "workspace",
    options: [
      { value: "everyone", label: "Everyone" },
      { value: "workspace", label: "People in my workspace" },
      { value: "organizers", label: "Only me and co-organizers" },
    ],
    hint: "Guests always wait until someone with an account is in the meeting.",
  },
};

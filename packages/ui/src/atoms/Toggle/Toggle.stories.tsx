import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { Toggle } from "./Toggle.tsx";

const meta = {
  title: "Atoms/Toggle",
  component: Toggle,
  args: { id: "join-muted", label: "Join with microphone off", checked: false, onChange: fn() },
  decorators: [(Story) => <div className="max-w-105">{Story()}</div>],
  // Flipping the switch in the gallery updates the story's `checked` arg, like a real parent would.
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <Toggle
        {...args}
        onChange={(next) => {
          args.onChange(next);
          updateArgs({ checked: next });
        }}
      />
    );
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const On: Story = { args: { checked: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = {
  args: {
    disabled: true,
    label: "AI notes for this meeting",
    description: "Only the host can change this.",
  },
};
export const DisabledOn: Story = {
  args: {
    disabled: true,
    checked: true,
    label: "AI notes for this meeting",
    description: "Only the host can change this.",
  },
};
export const WithDescription: Story = {
  args: { label: "AI notes for this meeting", description: "Everyone sees a Transcribing badge.", checked: true },
};

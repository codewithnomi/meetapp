import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { SegmentedControl } from "./SegmentedControl.tsx";

const meta = {
  title: "Molecules/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "Theme",
    value: "light",
    options: [
      { value: "light", label: "Light", icon: "sun" },
      { value: "dark", label: "Dark", icon: "moon" },
      { value: "system", label: "Same as my computer", icon: "monitor" },
    ],
    onChange: fn(),
  },
  // Choosing an option in the gallery updates the story's `value` arg, like a real parent would.
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <SegmentedControl
        {...args}
        onChange={(value) => {
          args.onChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
// Only one option of a radio group can have focus: the chosen one.
export const Focused: Story = { parameters: { pseudo: { focusVisible: ['[aria-checked="true"]'] } } };
export const Layout: Story = {
  args: {
    label: "Layout",
    value: "grid",
    options: [
      { value: "grid", label: "Grid" },
      { value: "speaker", label: "Speaker" },
    ],
  },
};

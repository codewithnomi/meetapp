import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { AccentPicker } from "./AccentPicker.tsx";

const meta = {
  title: "Molecules/AccentPicker",
  component: AccentPicker,
  args: {
    label: "Accent color",
    value: "sky",
    labels: {
      sky: "Sky blue",
      blue: "Blue",
      purple: "Purple",
      pink: "Pink",
      red: "Red",
      orange: "Orange",
      green: "Green",
      teal: "Teal",
    },
    onChange: fn(),
  },
  // Choosing a color in the gallery updates the story's `value` arg, like a real parent would.
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <AccentPicker
        {...args}
        onChange={(value) => {
          args.onChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
} satisfies Meta<typeof AccentPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
// Only one option of a radio group can have focus: the chosen one.
export const Focused: Story = { parameters: { pseudo: { focusVisible: ['[aria-checked="true"]'] } } };
export const PurpleChosen: Story = { args: { value: "purple" } };

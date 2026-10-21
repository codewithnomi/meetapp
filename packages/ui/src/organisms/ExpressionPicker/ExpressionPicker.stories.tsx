import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ExpressionPicker } from "./ExpressionPicker.tsx";
import { SAMPLE_EXPRESSIONS } from "./samples.ts";

const meta = {
  title: "Organisms/ExpressionPicker",
  component: ExpressionPicker,
  args: { ...SAMPLE_EXPRESSIONS, onClose: fn() },
  decorators: [(Story) => <div className="max-w-95 bg-surface p-3">{Story()}</div>],
} satisfies Meta<typeof ExpressionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
/** The workspace turned GIFs off: no GIFs tab or section. */
export const WithoutGifs: Story = { args: { gifs: undefined } };

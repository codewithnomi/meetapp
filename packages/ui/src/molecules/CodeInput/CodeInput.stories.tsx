import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { CodeInput, type CodeInputProps } from "./CodeInput.tsx";

const digitLabel = (position: number, length: number) => `Digit ${String(position)} of ${String(length)}`;

/** Keeps the typed digits, so the story behaves like the real screen. */
function Live(args: CodeInputProps) {
  const [value, setValue] = useState(args.value);
  return <CodeInput {...args} value={value} onChange={(next) => (setValue(next), args.onChange(next))} />;
}

const meta = {
  title: "Molecules/CodeInput",
  component: CodeInput,
  args: { id: "code", label: "Code", digitLabel, value: "4829", onChange: fn(), hint: "Paste works too." },
  render: (args) => <Live {...args} />,
  decorators: [(Story) => <div className="max-w-95">{Story()}</div>],
} satisfies Meta<typeof CodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Empty: Story = { args: { value: "" } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true, value: "482913" } };
export const WithError: Story = {
  args: { value: "482910", error: "That code isn't right. Check the email, or send a new code." },
};

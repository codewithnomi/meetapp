import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Input, type InputProps } from "./Input.tsx";

const meta = {
  title: "Atoms/Input",
  component: Input,
  args: { id: "display-name", label: "Display name", placeholder: "Aisha Khan", onChange: fn() },
  decorators: [(Story) => <div className="max-w-105">{Story()}</div>],
} satisfies Meta<Extract<InputProps, { label: string }>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Aisha Khan" } };
export const WithHint: Story = { args: { hint: "Shown to others in meetings." } };
export const WithError: Story = {
  args: {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "aisha@aria.com",
    defaultValue: "aisha@",
    error: "Enter a full email address, like aisha@aria.com.",
  },
};
export const WithErrorFocused: Story = {
  args: { ...WithError.args },
  parameters: { pseudo: { focusVisible: true } },
};
// A search field: its purpose is obvious, so it is named by aria-label instead of a visible label.
export const WithIcon: Story = {
  render: () => <Input id="search" aria-label="Search meetings" icon="search" placeholder="Weekly planning" />,
};

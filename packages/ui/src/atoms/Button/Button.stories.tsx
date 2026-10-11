import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "./Button.tsx";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "Start meeting", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true, loadingLabel: "Starting meeting" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Copy invite link", icon: "copy" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Schedule", icon: "calendar" } };
export const Danger: Story = { args: { variant: "danger", children: "Leave", icon: "leave" } };
export const Small: Story = { args: { size: "sm", children: "Admit" } };
export const Large: Story = { args: { size: "lg", children: "Join meeting" } };
export const LongText: Story = { args: { children: "Copy the invite link for the weekly planning meeting" } };
export const LoadingSecondary: Story = {
  args: { variant: "secondary", loading: true, loadingLabel: "Copying link", children: "Copy invite link" },
};
export const LoadingDanger: Story = {
  args: { variant: "danger", loading: true, loadingLabel: "Leaving", children: "Leave" },
};
export const LoadingSmall: Story = {
  args: { size: "sm", loading: true, loadingLabel: "Admitting", children: "Admit" },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DateTimeField } from "./DateTimeField.tsx";

const meta = {
  title: "Molecules/DateTimeField",
  component: DateTimeField,
  args: { id: "starts", label: "Starts", timeLabel: "Start time", date: "2026-11-25", time: "10:00", onChange: fn() },
} satisfies Meta<typeof DateTimeField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const AllDay: Story = { args: { allDay: true } };
export const Error: Story = {
  args: { label: "Ends", timeLabel: "End time", error: "The end must be after the start." },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

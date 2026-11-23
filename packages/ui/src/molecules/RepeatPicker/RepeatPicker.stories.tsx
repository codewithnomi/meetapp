import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RepeatPicker } from "./RepeatPicker.tsx";

const DAYS = [
  ["MO", "M", "Monday"],
  ["TU", "T", "Tuesday"],
  ["WE", "W", "Wednesday"],
  ["TH", "T", "Thursday"],
  ["FR", "F", "Friday"],
  ["SA", "S", "Saturday"],
  ["SU", "S", "Sunday"],
].map(([value, short, full]) => ({ value: value ?? "", short: short ?? "", full: full ?? "" }));

const meta = {
  title: "Molecules/RepeatPicker",
  component: RepeatPicker<string, string>,
  args: {
    id: "repeat",
    label: "Repeat",
    choices: [
      { value: "none", label: "Does not repeat" },
      { value: "weekdays", label: "Every weekday (Mon – Fri)" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
    ],
    kind: "weekly",
    noneKind: "none",
    weeklyKind: "weekly",
    days: { label: "Repeat on", days: DAYS, chosen: ["WE"] },
    until: { label: "End repeat", hint: "Leave empty to repeat with no end.", value: "2026-12-30" },
    onChange: fn(),
  },
} satisfies Meta<typeof RepeatPicker<string, string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Weekly: Story = {};
export const DoesNotRepeat: Story = { args: { kind: "none" } };
export const Monthly: Story = { args: { kind: "monthly" } };
export const Error: Story = {
  args: { until: { label: "End repeat", value: "2026-11-01", error: "End repeat must be after the first meeting." } },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

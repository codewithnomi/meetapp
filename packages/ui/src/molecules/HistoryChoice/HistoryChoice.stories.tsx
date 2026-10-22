import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { HistoryChoice } from "./HistoryChoice.tsx";

const meta = {
  title: "Molecules/HistoryChoice",
  component: HistoryChoice,
  args: {
    legend: "What can Hina see?",
    labels: {
      none: "Don't include history",
      days: "History from the last few days",
      all: "All history",
      daysField: "Days",
    },
    value: { from: "all" },
    onChange: fn(),
  },
  decorators: [(Story) => <div className="w-110 bg-surface p-6 text-ink">{Story()}</div>],
} satisfies Meta<typeof HistoryChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};
export const None: Story = { args: { value: { from: "none" } } };
export const Days: Story = { args: { value: { from: "days", days: 30 } } };
export const DaysOutOfRange: Story = {
  args: { value: { from: "days", days: 400 }, daysError: "Choose 1 to 365 days" },
};

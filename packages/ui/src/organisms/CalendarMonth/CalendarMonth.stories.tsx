import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CalendarMonth, type MonthDay } from "./CalendarMonth.tsx";

const meeting = (id: string, title: string, extra: object = {}) => ({
  id,
  title,
  time: "10:00",
  state: "accepted" as const,
  stateLabel: "Accepted",
  start: 600,
  end: 630,
  ...extra,
});
// November 2026 from Monday 26 October: 5 weeks.
const days: MonthDay[] = Array.from({ length: 35 }, (_, i) => {
  const date = new Date(2026, 9, 26 + i);
  const n = date.getDate();
  const busy = n === 18 && date.getMonth() === 10;
  return {
    key: `d${String(i)}`,
    label: String(n),
    fullLabel: date.toDateString(),
    dayNumber: String(n),
    outside: date.getMonth() !== 10,
    today: n === 25 && date.getMonth() === 10,
    allDay:
      n === 4
        ? [{ id: `a${String(i)}`, title: "Offsite", time: "All day", state: "accepted", stateLabel: "Accepted" }]
        : [],
    meetings: busy
      ? ["Stand-up", "Design review", "Hiring sync", "Customer call", "Retro"].map((t, k) =>
          meeting(`${String(i)}-${String(k)}`, t),
        )
      : n % 7 === 2
        ? [
            meeting(`m${String(i)}`, "Stand-up", { repeats: true }),
            meeting(`n${String(i)}`, "1:1", { state: "tentative", stateLabel: "Maybe" }),
          ]
        : [],
  };
});

const meta = {
  title: "Organisms/CalendarMonth",
  component: CalendarMonth,
  args: { days, moreLabel: (count: number) => `+${String(count)} more`, onOpen: fn(), onMore: fn() },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CalendarMonth>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {};
export const Empty: Story = { args: { days: days.map((d) => ({ ...d, meetings: [], allDay: [] })) } };

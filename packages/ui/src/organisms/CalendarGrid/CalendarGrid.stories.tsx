import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CalendarGrid, type GridDay, type GridMeeting } from "./CalendarGrid.tsx";

const m = (
  id: string,
  title: string,
  [start, end]: [number, number],
  extra: Partial<GridMeeting> = {},
): GridMeeting => ({
  id,
  title,
  time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
  state: "accepted",
  stateLabel: "Accepted",
  start,
  end,
  ...extra,
});
const standUp = (id: string) => m(id, "Stand-up", [570, 585], { repeats: true });
const day = (key: string, label: string, meetings: GridMeeting[], extra: Partial<GridDay> = {}): GridDay => ({
  key,
  label,
  fullLabel: label,
  allDay: [],
  meetings,
  ...extra,
});
const week: GridDay[] = [
  day("mon", "Mon 23", [
    standUp("1"),
    m("2", "Customer call", [840, 900], { state: "tentative", stateLabel: "Maybe" }),
  ]),
  day("tue", "Tue 24", [
    standUp("3"),
    m("4", "Design review", [660, 720]),
    m("5", "Hiring sync", [660, 690], { state: "declined", stateLabel: "Declined" }),
  ]),
  day(
    "wed",
    "Wed 25",
    [standUp("6"), m("7", "Weekly planning", [600, 630], { repeats: true }), m("8", "1:1 Sara", [930, 960])],
    {
      today: true,
    },
  ),
  day("thu", "Thu 26", [m("9", "Stand-up", [570, 585], { state: "cancelled", stateLabel: "Cancelled" })], {
    allDay: [{ id: "10", title: "Team offsite", time: "All day", state: "accepted", stateLabel: "Accepted" }],
  }),
  day("fri", "Fri 27", [
    standUp("11"),
    m("12", "Release check", [780, 870], { state: "none", stateLabel: "No answer" }),
  ]),
];

const meta = {
  title: "Organisms/CalendarGrid",
  component: CalendarGrid,
  args: {
    days: week,
    hourLabels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`),
    allDayLabel: "All day",
    moreLabel: (n: number) => `+${String(n)} more`,
    nowMinute: 10 * 60 + 20,
    onOpen: fn(),
    onMore: fn(),
  },
  decorators: [(Story) => <div className="flex h-150 flex-col bg-surface">{Story()}</div>],
} satisfies Meta<typeof CalendarGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkWeek: Story = {};
export const Day: Story = { args: { days: [week[2] as GridDay] } };
export const Busy: Story = {
  args: {
    days: [
      day(
        "wed",
        "Wed 25",
        Array.from({ length: 6 }, (_, i) => m(String(i), `Meeting ${String(i + 1)}`, [600, 660])),
        { today: true },
      ),
    ],
  },
};
export const Empty: Story = { args: { days: week.map((d) => ({ ...d, meetings: [], allDay: [] })) } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PollCard } from "./PollCard.tsx";

const options = [
  { id: "a", text: "Tuesday" },
  { id: "b", text: "Wednesday" },
  { id: "c", text: "Thursday" },
];

const meta = {
  title: "Molecules/PollCard",
  component: PollCard,
  args: {
    question: "Which day should we release the invite flow?",
    about: "Poll by Aisha Khan · One answer · Names shown",
    options,
    multiple: false,
    chosen: [],
    hint: "Vote to see the results",
    onVote: fn(),
    close: { label: "Close poll", onClose: fn() },
  },
  decorators: [(Story) => <div className="bg-bg p-6">{Story()}</div>],
} satisfies Meta<typeof PollCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Voted: Story = {
  args: {
    chosen: ["c"],
    results: {
      summary: "17 people voted · you can change your vote until the poll closes",
      options: [
        { id: "a", percent: 18, label: "18% · 3", names: [] },
        { id: "b", percent: 29, label: "29% · 5", names: [] },
        { id: "c", percent: 53, label: "53% · 9", names: [] },
      ],
    },
  },
};
export const Closed: Story = { args: { ...Voted.args, closedLabel: "Closed" } };
export const Several: Story = { args: { multiple: true, about: "Poll by Bilal Ahmed · Several answers · Anonymous" } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DateTimeField } from "../../molecules/DateTimeField/index.ts";
import { PeoplePicker } from "../../molecules/PeoplePicker/index.ts";
import { RepeatPicker } from "../../molecules/RepeatPicker/index.ts";
import { ScheduleForm } from "./ScheduleForm.tsx";

const meta = {
  title: "Organisms/ScheduleForm",
  component: ScheduleForm,
  args: {
    heading: "New meeting",
    cancel: { label: "Cancel", onClick: fn() },
    submit: { label: "Send", busyLabel: "Sending…", onSubmit: fn() },
    title: { label: "Title", value: "Weekly planning", onChange: fn() },
    people: (
      <PeoplePicker
        label="People to invite"
        picked={[
          { id: "1", name: "Sara Malik", removeLabel: "Remove Sara Malik" },
          { id: "2", name: "lena@partner.example", removeLabel: "Remove lena@partner.example" },
        ]}
        query=""
        onQueryChange={fn()}
        suggestions={[]}
        suggestionsLabel="Suggestions"
        onPick={fn()}
        onRemove={fn()}
      />
    ),
    starts: (
      <DateTimeField id="starts" label="Starts" timeLabel="Start time" date="2026-11-25" time="10:00" onChange={fn()} />
    ),
    ends: <DateTimeField id="ends" label="Ends" timeLabel="End time" date="2026-11-25" time="10:30" onChange={fn()} />,
    allDay: { label: "All day", checked: false, onChange: fn() },
    timeZoneNote: "Time zone: London (GMT)",
    repeat: (
      <RepeatPicker
        id="repeat"
        label="Repeat"
        choices={[
          { value: "none", label: "Does not repeat" },
          { value: "weekly", label: "Weekly" },
        ]}
        kind="none"
        noneKind="none"
        weeklyKind="weekly"
        days={{ label: "Repeat on", days: [], chosen: [] }}
        until={{ label: "End repeat", value: "" }}
        onChange={fn()}
      />
    ),
    notes: { label: "Notes", value: "Plan the week: blockers, releases, who is away.", onChange: fn() },
    footnote: "Everyone gets an email with a calendar file, so it also shows in Outlook, Google and Apple Calendar.",
  },
  decorators: [(Story) => <div className="flex h-225 flex-col bg-surface">{Story()}</div>],
} satisfies Meta<typeof ScheduleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {};
export const Edit: Story = {
  args: { heading: "Edit meeting", submit: { label: "Send update", busyLabel: "Sending…", onSubmit: fn() } },
};
export const Sending: Story = {
  args: { submit: { label: "Send", busyLabel: "Sending…", busy: true, onSubmit: fn() } },
};
export const Errors: Story = {
  args: {
    title: { label: "Title", value: "", error: "Give the meeting a title.", onChange: fn() },
    error: "You've sent a lot of invites. Try again in 12 minutes.",
  },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };

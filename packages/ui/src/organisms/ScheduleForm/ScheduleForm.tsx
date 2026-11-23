// ScheduleForm (organism): the New meeting / Edit meeting page of the approved "Calendar: New meeting"
// screen (F13 AC-F13-07, 10, 11, 31): title, people to invite (colleagues or any email), start and end,
// All day, time zone, repeat and notes, with Cancel and Send at the top. Field errors show under their
// field; Send waits while busy. The values and all words arrive as props; changes leave as callbacks.
import type { FormEvent, ReactNode } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Toggle } from "../../atoms/Toggle/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface TextField {
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}

export interface ScheduleFormProps {
  heading: string;
  cancel: { label: string; onClick: () => void };
  /** "Send" or "Send update"; `busyLabel` while it is being sent. */
  submit: { label: string; busyLabel: string; busy?: boolean; onSubmit: () => void };
  title: TextField;
  /** The PeoplePicker, filled by the page. */
  people: ReactNode;
  /** The start and end DateTimeFields. */
  starts: ReactNode;
  ends: ReactNode;
  allDay: { label: string; checked: boolean; onChange: (checked: boolean) => void };
  /** "Time zone: London (GMT)". */
  timeZoneNote: string;
  /** The RepeatPicker. */
  repeat: ReactNode;
  notes: TextField;
  /** A whole-form error, e.g. "You've sent a lot of invites. Try again in 12 minutes." */
  error?: string | undefined;
  footnote: string;
}

function Notes({ notes }: { notes: TextField }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="schedule-notes" className="px-4 text-[13px] font-[550] text-ink">
        {notes.label}
      </label>
      <textarea
        id="schedule-notes"
        rows={4}
        value={notes.value}
        aria-invalid={notes.error ? true : undefined}
        aria-describedby={notes.error ? "schedule-notes-error" : undefined}
        onChange={(event) => notes.onChange(event.target.value)}
        className={cx(
          "resize-y rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 font-[inherit] text-[14px] text-ink",
          FOCUS_RING,
        )}
      />
      {notes.error ? (
        <p id="schedule-notes-error" role="alert" className="m-0 px-4 text-[12px] font-medium text-danger">
          {notes.error}
        </p>
      ) : null}
    </div>
  );
}

export function ScheduleForm(props: ScheduleFormProps) {
  const { heading, cancel, submit, title, people, starts, ends, allDay, timeZoneNote, repeat, notes } = props;
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!submit.busy) submit.onSubmit();
  };
  return (
    <form onSubmit={send} aria-labelledby="schedule-heading" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <h2 id="schedule-heading" className="m-0 flex-1 text-[20px] font-bold">
          {heading}
        </h2>
        <Button type="button" variant="secondary" onClick={cancel.onClick}>
          {cancel.label}
        </Button>
        <Button type="submit" icon="send" aria-busy={submit.busy ? true : undefined}>
          {submit.busy ? submit.busyLabel : submit.label}
        </Button>
      </header>
      <div className="mx-auto flex w-full max-w-190 flex-col gap-4 overflow-y-auto p-6">
        {props.error ? (
          <p role="alert" className="m-0 rounded-md bg-danger-soft px-3.5 py-2.5 text-[14px] text-ink">
            {props.error}
          </p>
        ) : null}
        <Input
          id="schedule-title"
          label={title.label}
          value={title.value}
          {...(title.error ? { error: title.error } : {})}
          onChange={(event) => title.onChange(event.target.value)}
        />
        {people}
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {starts}
          {ends}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Toggle id="schedule-all-day" {...allDay} />
          <span className="text-[13px] text-ink-muted">{timeZoneNote}</span>
        </div>
        {repeat}
        <Notes notes={notes} />
        <p className="m-0 text-[13px] text-ink-muted">{props.footnote}</p>
      </div>
    </form>
  );
}

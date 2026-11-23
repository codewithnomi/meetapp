// DateTimeField (molecule): a date and, unless the meeting is all day, a time, side by side (approved
// "Calendar: New meeting" screen, F13). Uses the computer's own date and time pickers, which follow its
// language, region and 12/24-hour setting. Values are "YYYY-MM-DD" and "HH:MM". All words arrive as props.
import { Input } from "../../atoms/Input/index.ts";

export interface DateTimeFieldProps {
  /** Unique on the page. */
  id: string;
  /** "Starts", "Ends". */
  label: string;
  /** Spoken name of the time box: "Start time". */
  timeLabel: string;
  date: string;
  time: string;
  allDay?: boolean;
  error?: string | undefined;
  onChange: (value: { date: string; time: string }) => void;
}

export function DateTimeField({ id, label, timeLabel, date, time, allDay, error, onChange }: DateTimeFieldProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Input
        id={`${id}-date`}
        type="date"
        label={label}
        value={date}
        {...(error ? { error } : {})}
        onChange={(event) => onChange({ date: event.target.value, time })}
        className="w-52"
      />
      {allDay ? null : (
        <Input
          id={`${id}-time`}
          type="time"
          aria-label={timeLabel}
          value={time}
          step={900}
          onChange={(event) => onChange({ date, time: event.target.value })}
          className="mt-6 w-36"
        />
      )}
    </div>
  );
}

// ReminderCard (molecule): the corner card of the approved "Calendar: Reminder" screen (F13 AC-F13-21):
// "Starts in 15 min" or "Starting now", the title and time, Join, Snooze and Dismiss. Clicking the text
// opens the meeting's details. All words arrive as props.
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface Action {
  label: string;
  onClick: () => void;
}

export interface ReminderCardProps {
  /** "Starts in 15 min" or "Starting now". */
  heading: string;
  title: string;
  /** "10:00 – 10:30". */
  time: string;
  open: Action;
  /** Only while the meeting can be joined. */
  join?: Action | undefined;
  snooze: Action;
  dismiss: Action;
}

export function ReminderCard({ heading, title, time, open, join, snooze, dismiss }: ReminderCardProps) {
  return (
    <section
      aria-label={`${heading}: ${title}`}
      className="flex w-85 flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 text-ink shadow-2"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="calendar" size={22} className="text-accent-text" />
        <button
          type="button"
          onClick={open.onClick}
          aria-label={open.label}
          className={cx(
            "flex min-w-0 flex-1 cursor-pointer flex-col rounded-sm border-0 bg-transparent p-0 text-left font-[inherit] text-ink",
            FOCUS_RING,
          )}
        >
          <strong className="text-[14px]">{heading}</strong>
          <span className="truncate text-[13px] text-ink-muted">
            {title} · {time}
          </span>
        </button>
        <IconButton icon="close" label={dismiss.label} variant="ghost" size="sm" onClick={dismiss.onClick} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={snooze.onClick}>
          {snooze.label}
        </Button>
        {join ? (
          <Button size="sm" onClick={join.onClick}>
            {join.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

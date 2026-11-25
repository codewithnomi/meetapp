// The Month view (approved "Calendar: Month" screen): a grid of days with up to 3 meetings each and
// "+N more" (AC-F13-01). A day's meetings, or "+N more", open like blocks in the week grid.
import { cx, FOCUS_RING } from "../../lib/cx.ts";
import { MeetingBlock } from "../../molecules/MeetingBlock/index.ts";
import type { GridDay } from "../CalendarGrid/index.ts";

const SHOWN = 3;

export interface MonthDay extends GridDay {
  /** The day of the month: "25". */
  dayNumber: string;
  /** A day of the next or last month, shown dimmed. */
  outside?: boolean;
}

export interface CalendarMonthProps {
  days: MonthDay[];
  /** "+{n} more" made by the caller. */
  moreLabel: (count: number) => string;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
}

function Day({ day, moreLabel, onOpen, onMore }: { day: MonthDay } & Omit<CalendarMonthProps, "days">) {
  const all = [...day.allDay, ...day.meetings];
  const hidden = all.slice(SHOWN);
  const tone = day.today ? "font-bold text-accent-text" : day.outside ? "text-ink-subtle" : "text-ink";
  return (
    <li
      aria-label={day.fullLabel}
      className="flex min-h-24 min-w-0 flex-col gap-0.75 border-b border-l border-line p-1.5 text-[12px]"
    >
      <span className={tone}>{day.dayNumber}</span>
      {all.slice(0, SHOWN).map((m) => (
        <MeetingBlock key={m.id} {...m} compact onOpen={() => onOpen(m.id)} />
      ))}
      {hidden.length > 0 ? (
        <button
          type="button"
          onClick={() => onMore(hidden.map((m) => m.id))}
          className={cx(
            "cursor-pointer self-start rounded-sm border-0 bg-transparent p-0 font-[inherit] text-[12px] font-semibold text-accent-text",
            FOCUS_RING,
          )}
        >
          {moreLabel(hidden.length)}
        </button>
      ) : null}
    </li>
  );
}

export function CalendarMonth({ days, moreLabel, onOpen, onMore }: CalendarMonthProps) {
  return (
    <ol className="m-0 grid flex-1 list-none grid-cols-7 p-0">
      {days.map((day) => (
        <Day key={day.key} day={day} moreLabel={moreLabel} onOpen={onOpen} onMore={onMore} />
      ))}
    </ol>
  );
}

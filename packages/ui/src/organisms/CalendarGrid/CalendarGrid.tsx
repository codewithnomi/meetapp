// CalendarGrid (organism): the Day / Work week / Week grid of the approved "Calendar" screen (F13). Hours
// on the left, one column per day, half-hour lines, meetings placed by time (overlaps side by side, then
// "+N more"), all-day meetings in a strip on top, and the red now-line in today's column. It scrolls to
// `scrollToMinute` (08:00 or now) when shown. All words and times arrive as props, already formatted.
import { useEffect, useRef } from "react";
import { MeetingBlock, type MeetingBlockState } from "../../molecules/MeetingBlock/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { layoutDay } from "./layout.ts";

export const HOUR_PX = 48;

export interface GridMeeting {
  id: string;
  title: string;
  time: string;
  state: MeetingBlockState;
  stateLabel: string;
  repeats?: boolean;
  /** Minutes from midnight of this day (a meeting crossing midnight is cut to the day). */
  start: number;
  end: number;
}

export interface GridDay {
  key: string;
  /** "Wed 25". */
  label: string;
  /** "Wednesday 25 November" for screen readers. */
  fullLabel: string;
  today?: boolean;
  allDay: Omit<GridMeeting, "start" | "end">[];
  meetings: GridMeeting[];
}

export interface CalendarGridProps {
  days: GridDay[];
  /** 24 hour labels, already formatted for the person's 12/24-hour setting. */
  hourLabels: string[];
  allDayLabel: string;
  /** "+{n} more" made by the caller. */
  moreLabel: (count: number) => string;
  /** Minutes from midnight now, shown as a line in today's column. */
  nowMinute?: number | undefined;
  scrollToMinute?: number;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
}

/** Where a block sits in its day column. */
const box = (start: number, end: number, lane: number, slots: number) => ({
  top: (start / 60) * HOUR_PX,
  height: Math.max(((end - start) / 60) * HOUR_PX - 2, 18),
  left: `calc(${String((lane / slots) * 100)}% + 2px)`,
  width: `calc(${String(100 / slots)}% - 4px)`,
});

function NowLine({ minute }: { minute: number }) {
  return (
    <div
      data-testid="now-line"
      aria-hidden="true"
      className="pointer-events-none absolute right-0 left-0 h-0.5 bg-danger before:absolute before:-top-1 before:-left-1.25 before:size-2.5 before:rounded-full before:bg-danger"
      style={{ top: (minute / 60) * HOUR_PX }}
    />
  );
}

function DayColumn({
  day,
  nowMinute,
  onOpen,
  onMore,
  moreLabel,
}: { day: GridDay } & Pick<CalendarGridProps, "nowMinute" | "onOpen" | "onMore" | "moreLabel">) {
  const { placed, more } = layoutDay(day.meetings);
  const byId = new Map(day.meetings.map((m) => [m.id, m]));
  return (
    <div
      role="group"
      aria-label={day.fullLabel}
      className="relative border-l border-line bg-[linear-gradient(var(--line)_1px,transparent_1px)] bg-size-[100%_24px]"
      style={{ height: 24 * HOUR_PX }}
    >
      {placed.map((p) => {
        const m = byId.get(p.id);
        if (!m) return null;
        return (
          <MeetingBlock
            key={m.id}
            {...m}
            compact={p.end - p.start < 30}
            onOpen={() => onOpen(m.id)}
            className="absolute"
            style={box(p.start, p.end, p.lane, p.slots)}
          />
        );
      })}
      {more.map((chip) => (
        <button
          key={chip.ids.join()}
          type="button"
          onClick={() => onMore(chip.ids)}
          style={box(chip.start, chip.end, chip.lane, chip.slots)}
          className={cx(
            "absolute cursor-pointer rounded-sm border-0 bg-surface-sunken px-1 text-[12px] font-semibold text-accent-text",
            FOCUS_RING,
          )}
        >
          {moreLabel(chip.ids.length)}
        </button>
      ))}
      {day.today && nowMinute !== undefined ? <NowLine minute={nowMinute} /> : null}
    </div>
  );
}

export function CalendarGrid(props: CalendarGridProps) {
  const { days, hourLabels, allDayLabel, scrollToMinute = 8 * 60 } = props;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: (scrollToMinute / 60) * HOUR_PX - HOUR_PX / 2 });
  }, [scrollToMinute]);
  const columns = { gridTemplateColumns: `56px repeat(${String(days.length)}, minmax(110px, 1fr))` };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
      <div className="grid border-b border-line" style={columns}>
        <span />
        {days.map((day) => (
          <div
            key={day.key}
            className={cx(
              "border-l border-line px-2.5 py-2 text-[13px]",
              day.today ? "font-bold text-accent-text" : "text-ink",
            )}
          >
            <span aria-hidden="true">{day.label}</span>
            <span className="sr-only">{day.fullLabel}</span>
          </div>
        ))}
        <span className="pt-2 pr-1.5 text-right text-[11px] text-ink-muted">{allDayLabel}</span>
        {days.map((day) => (
          <div key={day.key} className="flex min-h-7.5 flex-col gap-0.5 border-l border-line p-0.75">
            {day.allDay.map((m) => (
              <MeetingBlock key={m.id} {...m} compact onOpen={() => props.onOpen(m.id)} />
            ))}
          </div>
        ))}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={columns}>
          <div aria-hidden="true">
            {hourLabels.map((label) => (
              <div key={label} className="h-12 pr-1.5 text-right text-[11px] text-ink-muted">
                {label}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn key={day.key} day={day} {...props} />
          ))}
        </div>
      </div>
    </div>
  );
}

// CalendarGrid (organism): the Day / Work week / Week grid of the approved "Calendar" screen (F13). Hours
// on the left, one column per day, half-hour lines, meetings placed by time (overlaps side by side, then
// "+N more"), all-day meetings in a strip on top, and the red now-line in today's column. It scrolls to
// `scrollToMinute` (08:00 or now) when shown. All words and times arrive as props, already formatted.
import { useEffect, useRef } from "react";
import { MeetingBlock, type MeetingBlockState } from "../../molecules/MeetingBlock/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { layoutDay, type MoreChip } from "./layout.ts";

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
  /** Names the scrolling hours, which the keyboard can reach and scroll: "Hours". */
  hoursLabel: string;
  /** "+{n} more" made by the caller. */
  moreLabel: (count: number) => string;
  /** Minutes from midnight now, shown as a line in today's column. */
  nowMinute?: number | undefined;
  scrollToMinute?: number;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
  /** Dragging (or clicking) empty time: that range, in minutes of the day, snapped to half hours. */
  onPickTime?: ((dayKey: string, start: number, end: number) => void) | undefined;
}

/** Where a block sits in its day column. */
const box = (start: number, end: number, lane: number, slots: number) => ({
  top: (start / 60) * HOUR_PX,
  height: Math.max(((end - start) / 60) * HOUR_PX - 2, 18),
  left: `calc(${String((lane / slots) * 100)}% + 2px)`,
  width: `calc(${String(100 / slots)}% - 4px)`,
});

const HALF = 30;
/** The half hour under the pointer, in minutes of the day. */
const halfHourAt = (event: React.PointerEvent<HTMLElement>) => {
  const box = event.currentTarget.getBoundingClientRect();
  const minute = ((event.clientY - box.top) / HOUR_PX) * 60;
  return Math.min(24 * 60 - HALF, Math.max(0, Math.floor(minute / HALF) * HALF));
};

/** Press on empty time and let go: the half hours between, at least one. */
function useDragTime(dayKey: string, onPickTime: CalendarGridProps["onPickTime"]) {
  const from = useRef<number | undefined>(undefined);
  return {
    down: (event: React.PointerEvent<HTMLElement>) => {
      from.current = event.target === event.currentTarget ? halfHourAt(event) : undefined;
    },
    up: (event: React.PointerEvent<HTMLElement>) => {
      const start = from.current;
      from.current = undefined;
      if (start === undefined || !onPickTime) return;
      const end = halfHourAt(event);
      onPickTime(dayKey, Math.min(start, end), Math.max(start, end) + HALF);
    },
  };
}

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

function MoreChipButton({ chip, label, onMore }: { chip: MoreChip; label: string; onMore: (ids: string[]) => void }) {
  return (
    <button
      type="button"
      onClick={() => onMore(chip.ids)}
      style={box(chip.start, chip.end, chip.lane, chip.slots)}
      className={cx(
        "absolute cursor-pointer rounded-sm border-0 bg-surface-sunken px-1 text-[12px] font-semibold text-accent-text",
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}

function DayColumn({
  day,
  nowMinute,
  onOpen,
  onMore,
  moreLabel,
  onPickTime,
}: { day: GridDay } & Pick<CalendarGridProps, "nowMinute" | "onOpen" | "onMore" | "moreLabel" | "onPickTime">) {
  const { placed, more } = layoutDay(day.meetings);
  const drag = useDragTime(day.key, onPickTime);
  const byId = new Map(day.meetings.map((m) => [m.id, m]));
  return (
    <div
      role="group"
      onPointerDown={drag.down}
      onPointerUp={drag.up}
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
        <MoreChipButton key={chip.ids.join()} chip={chip} label={moreLabel(chip.ids.length)} onMore={onMore} />
      ))}
      {day.today && nowMinute !== undefined ? <NowLine minute={nowMinute} /> : null}
    </div>
  );
}

/** The day names and the all-day row, above the hours. */
function GridHead({
  days,
  allDayLabel,
  onOpen,
  columns,
}: Pick<CalendarGridProps, "days" | "allDayLabel" | "onOpen"> & { columns: React.CSSProperties }) {
  return (
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
            <MeetingBlock key={m.id} {...m} compact onOpen={() => onOpen(m.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CalendarGrid(props: CalendarGridProps) {
  const { days, hourLabels, hoursLabel, scrollToMinute = 8 * 60 } = props;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: (scrollToMinute / 60) * HOUR_PX - HOUR_PX / 2 });
  }, [scrollToMinute]);
  const columns = { gridTemplateColumns: `56px repeat(${String(days.length)}, minmax(110px, 1fr))` };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
      <GridHead {...props} columns={columns} />
      <div
        ref={scroller}
        role="region"
        aria-label={hoursLabel}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling area must be reachable by keyboard (axe "scrollable-region-focusable")
        tabIndex={0}
        className={cx("min-h-0 flex-1 overflow-y-auto", FOCUS_RING)}
      >
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

// CalendarPage (page): the approved "Calendar" screen (F13 AC-F13-01–05, 32): Today, ‹ ›, the date range,
// Day / Work week / Week / Month (remembered on this computer), New meeting, the meetings of the open
// workspace by time, and a meeting's details beside the grid. Changes made elsewhere arrive on the live
// line. Offline, the last calendar stays with a notice.
import { Button, CalendarGrid, CalendarMonth, IconButton, SegmentedControl, type GridDay } from "@meetapp/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../features/auth/index.ts";
import type { PreJoinState } from "../../features/meetings/index.ts";
import {
  CALENDAR_VIEWS,
  firstDayOf,
  hourLabels,
  minuteOfDay,
  rangeOf,
  savedView,
  saveView,
  step,
  useCalendar,
  useCalendarNews,
  useOnline,
  type CalendarOccurrence,
  type CalendarView,
  type TimeFormat,
} from "../../features/scheduling/index.ts";
import { WorkspaceShell, useCurrentWorkspace, type AppScreen } from "../../features/workspaces/index.ts";
import { gridDays } from "./calendar-days.ts";
import { DetailsPane, type CalendarEdit } from "./DetailsPane.tsx";
import { MoreDialog } from "./MoreDialog.tsx";
import { Status } from "./CalendarStatus.tsx";
import { useOpenOnLoad, type OpenOnLoad } from "./open-on-load.ts";

export interface CalendarPageProps {
  onNavigate: (screen: AppScreen) => void;
  onPreJoin: (state: PreJoinState) => void;
  /** The New meeting form, with a range dragged in the grid. */
  onNewMeeting?: ((range?: { startsAt: Date; endsAt: Date }) => void) | undefined;
  onEdit?: ((edit: CalendarEdit) => void) | undefined;
  /** A meeting to show the details of once the calendar has it (a reminder or invite card was clicked). */
  openOnLoad?: OpenOnLoad | undefined;
  /** Tests set the clock. */
  now?: () => Date;
}

const timeFormat = (): TimeFormat => ({
  locale: navigator.language,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/** The clock, ticking every minute for the now-line. */
function useNow(now: () => Date): Date {
  const [at, setAt] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => setAt(now()), 30_000);
    return () => clearInterval(timer);
  }, [now]);
  return at;
}

function rangeTitle(view: CalendarView, days: Date[], format: TimeFormat): string {
  const first = days[0] ?? new Date();
  const last = days.at(-1) ?? first;
  const middle = days[Math.floor(days.length / 2)] ?? first;
  if (view === "month")
    return new Intl.DateTimeFormat(format.locale, { month: "long", year: "numeric" }).format(middle);
  const f = new Intl.DateTimeFormat(format.locale, { day: "numeric", month: "long", year: "numeric" });
  return view === "day" ? f.format(first) : f.formatRange(first, last);
}

function ViewSwitch({ view, onView }: { view: CalendarView; onView: (v: CalendarView) => void }) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      label={t("calendar.view")}
      options={CALENDAR_VIEWS.map((value) => ({ value, label: t(`calendar.views.${value}`) }))}
      value={view}
      onChange={onView}
    />
  );
}

function Header({
  state,
  format,
  onNewMeeting,
  online,
}: {
  state: ReturnType<typeof useCalendarState>;
  format: TimeFormat;
  onNewMeeting: (() => void) | undefined;
  online: boolean;
}) {
  const { view, changeView: onView, today: onToday, stepBy: onStep } = state;
  const title = rangeTitle(view, state.range.days, format);
  const { t } = useTranslation();
  return (
    <header className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
      <h1 tabIndex={-1} className="m-0 mr-2 text-[20px] font-bold outline-none">
        {t("calendar.title")}
      </h1>
      <Button variant="secondary" size="sm" onClick={onToday}>
        {t("calendar.today")}
      </Button>
      <IconButton
        icon="chevron-left"
        label={t("calendar.previous")}
        variant="ghost"
        size="sm"
        onClick={() => onStep(-1)}
      />
      <IconButton icon="chevron" label={t("calendar.next")} variant="ghost" size="sm" onClick={() => onStep(1)} />
      <strong aria-live="polite" className="flex-1 text-[15px]">
        {title}
      </strong>
      <ViewSwitch view={view} onView={onView} />
      {onNewMeeting ? (
        <Button icon="plus" onClick={() => onNewMeeting()} disabled={!online}>
          {t("calendar.newMeeting")}
        </Button>
      ) : null}
    </header>
  );
}

function useCalendarState(now: () => Date) {
  const [view, setView] = useState<CalendarView>(savedView);
  const [anchor, setAnchor] = useState(now);
  const range = useMemo(() => rangeOf(view, anchor, firstDayOf(navigator.language)), [view, anchor]);
  return {
    view,
    anchor,
    range,
    changeView: (next: CalendarView) => (saveView(next), setView(next)),
    today: () => setAnchor(now()),
    stepBy: (by: -1 | 1) => setAnchor((a) => step(view, a, by)),
  };
}

/** A range dragged in the grid opens New meeting with it (AC-F13-07). */
const pickTime = (onNewMeeting: CalendarPageProps["onNewMeeting"], online: boolean) =>
  onNewMeeting && online
    ? (dayKey: string, start: number, end: number) => {
        const day = new Date(dayKey);
        const at = (minute: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
        onNewMeeting({ startsAt: at(start), endsAt: at(end) });
      }
    : undefined;

function Body({
  view,
  month,
  days,
  format,
  clock,
  onOpen,
  onMore,
  onPickTime,
  children,
}: {
  view: CalendarView;
  month: number;
  days: GridDay[];
  format: TimeFormat;
  clock: Date;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
  onPickTime: ((dayKey: string, start: number, end: number) => void) | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1">
      {view === "month" ? (
        <CalendarMonth
          days={days.map((day) => {
            const date = new Date(day.key);
            return { ...day, dayNumber: String(date.getDate()), outside: date.getMonth() !== month };
          })}
          moreLabel={(count) => t("calendar.more", { count })}
          onOpen={onOpen}
          onMore={onMore}
        />
      ) : (
        <CalendarGrid
          days={days}
          hourLabels={hourLabels(format)}
          allDayLabel={t("calendar.allDay")}
          moreLabel={(count) => t("calendar.more", { count })}
          nowMinute={minuteOfDay(clock, format)}
          onOpen={onOpen}
          onMore={onMore}
          onPickTime={onPickTime}
        />
      )}
      {children}
    </div>
  );
}

/** The open workspace's meetings in the shown range, as grid days, kept fresh by the live line. */
function useCalendarData(now: () => Date) {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  const { data: user } = useSession();
  const online = useOnline();
  const clock = useNow(now);
  const state = useCalendarState(now);
  const format = useMemo(() => timeFormat(), []);
  const calendar = useCalendar(current?.id, state.range);
  useCalendarNews();
  const occurrences = calendar.data?.occurrences ?? [];
  const byId = (id: string) => occurrences.find((o) => `${o.meetingId}|${o.originalStart}` === id);
  const days = gridDays(state.range.days, occurrences, { me: user?.id, format, today: clock, t });
  return { state, clock, format, online, calendar, occurrences, days, byId };
}

export function CalendarPage(props: CalendarPageProps) {
  const { onNavigate, onPreJoin, onNewMeeting, onEdit, now = () => new Date() } = props;
  const { state, clock, format, online, calendar, occurrences, days, byId } = useCalendarData(now);
  const [open, setOpen] = useState<CalendarOccurrence>();
  const [more, setMore] = useState<CalendarOccurrence[]>();
  const openId = (id: string) => setOpen(byId(id));
  useOpenOnLoad(props.openOnLoad, occurrences, setOpen);
  const showMore = (ids: string[]) => setMore(ids.map(byId).filter((o): o is CalendarOccurrence => o !== undefined));
  return (
    <WorkspaceShell screen="calendar" onNavigate={onNavigate}>
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Header state={state} format={format} onNewMeeting={onNewMeeting} online={online} />
        <Status online={online} calendar={calendar} empty={occurrences.length === 0} />
        <Body
          view={state.view}
          month={state.anchor.getMonth()}
          days={days}
          format={format}
          clock={clock}
          onOpen={openId}
          onMore={showMore}
          onPickTime={pickTime(onNewMeeting, online)}
        >
          {open ? (
            <DetailsPane
              key={open.meetingId + open.originalStart}
              occurrence={open}
              format={format}
              online={online}
              onClose={() => setOpen(undefined)}
              onPreJoin={onPreJoin}
              onEdit={(edit) => onEdit?.(edit)}
            />
          ) : null}
        </Body>
        {more ? (
          <MoreDialog
            occurrences={more}
            format={format}
            onOpen={(o) => (setMore(undefined), setOpen(o))}
            onClose={() => setMore(undefined)}
          />
        ) : null}
      </main>
    </WorkspaceShell>
  );
}

// CalendarPage (page): the approved "Calendar" screen (F13 AC-F13-01–05, 32): Today, ‹ ›, the date range,
// Day / Work week / Week / Month (remembered on this computer), New meeting, the meetings of the open
// workspace by time, and a meeting's details beside the grid. Changes made elsewhere arrive on the live
// line. Offline, the last calendar stays with a notice.
import { Button, CalendarGrid, IconButton, Notice, SegmentedControl, Spinner, type GridDay } from "@meetapp/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../features/auth/index.ts";
import type { PreJoinState } from "../../features/meetings/index.ts";
import {
  CALENDAR_VIEWS,
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
import { DetailsPane } from "./DetailsPane.tsx";
import { MoreDialog } from "./MoreDialog.tsx";
import { MonthView } from "./MonthView.tsx";

export interface CalendarPageProps {
  onNavigate: (screen: AppScreen) => void;
  onPreJoin: (state: PreJoinState) => void;
  /** T11: the New meeting form. */
  onNewMeeting?: (() => void) | undefined;
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
        <Button icon="plus" onClick={onNewMeeting} disabled={!online}>
          {t("calendar.newMeeting")}
        </Button>
      ) : null}
    </header>
  );
}

function useCalendarState(now: () => Date) {
  const [view, setView] = useState<CalendarView>(savedView);
  const [anchor, setAnchor] = useState(now);
  const range = useMemo(() => rangeOf(view, anchor), [view, anchor]);
  return {
    view,
    anchor,
    range,
    changeView: (next: CalendarView) => (saveView(next), setView(next)),
    today: () => setAnchor(now()),
    stepBy: (by: -1 | 1) => setAnchor((a) => step(view, a, by)),
  };
}

function Body({
  view,
  month,
  days,
  format,
  clock,
  onOpen,
  onMore,
  children,
}: {
  view: CalendarView;
  month: number;
  days: GridDay[];
  format: TimeFormat;
  clock: Date;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1">
      {view === "month" ? (
        <MonthView days={days} month={month} onOpen={onOpen} onMore={onMore} />
      ) : (
        <CalendarGrid
          days={days}
          hourLabels={hourLabels(format)}
          allDayLabel={t("calendar.allDay")}
          moreLabel={(count) => t("calendar.more", { count })}
          nowMinute={minuteOfDay(clock, format)}
          onOpen={onOpen}
          onMore={onMore}
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

export function CalendarPage({ onNavigate, onPreJoin, onNewMeeting, now = () => new Date() }: CalendarPageProps) {
  const { state, clock, format, online, calendar, occurrences, days, byId } = useCalendarData(now);
  const [open, setOpen] = useState<CalendarOccurrence>();
  const [more, setMore] = useState<CalendarOccurrence[]>();
  const openId = (id: string) => setOpen(byId(id));
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
        >
          {open ? (
            <DetailsPane
              key={open.meetingId + open.originalStart}
              occurrence={open}
              format={format}
              online={online}
              onClose={() => setOpen(undefined)}
              onPreJoin={onPreJoin}
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

function Status({
  online,
  calendar,
  empty,
}: {
  online: boolean;
  calendar: ReturnType<typeof useCalendar>;
  empty: boolean;
}) {
  const { t } = useTranslation();
  if (!online)
    return (
      <Notice tone="neutral" icon="signal" className="m-3">
        {t("calendar.offline")}
      </Notice>
    );
  if (calendar.isError && !calendar.data)
    return (
      <Notice
        tone="danger"
        className="m-3"
        action={{ label: t("calendar.retry"), onClick: () => void calendar.refetch() }}
      >
        {t("calendar.failed")}
      </Notice>
    );
  if (calendar.isPending) return <Spinner label={t("calendar.title")} className="m-3" />;
  if (calendar.data?.truncated)
    return (
      <Notice tone="neutral" className="m-3">
        {t("calendar.truncated")}
      </Notice>
    );
  if (empty) return <p className="m-0 px-5 py-3 text-[14px] text-ink-muted">{t("calendar.empty")}</p>;
  return null;
}

// "Upcoming" on the Meetings screen (F13 AC-F13-23): today's and tomorrow's scheduled meetings with their
// time, Join while it can be joined (AC-F13-03), and View calendar. Nothing shows when there are none;
// while loading a spinner, and on failure a note with Retry.
import { Button, Notice, Spinner } from "@meetapp/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { PreJoinState } from "../../features/meetings/index.ts";
import {
  formatRange,
  sameDay,
  upcomingOf,
  upcomingRange,
  useCalendar,
  useJoinScheduled,
  type CalendarOccurrence,
} from "../../features/scheduling/index.ts";

export interface UpcomingMeetingsProps {
  workspaceId: string;
  onPreJoin: (state: PreJoinState) => void;
  onViewCalendar: () => void;
  /** Tests set the clock. */
  now?: Date;
}

const format = () => ({ locale: navigator.language, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

function Row({ o, at, onJoin }: { o: CalendarOccurrence; at: Date; onJoin: (meetingId: string) => void }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-[600] text-ink">{o.title}</span>
        <span className="text-[12px] text-ink-muted">
          {t(sameDay(new Date(o.startsAt), at) ? "meetings.upcoming.today" : "meetings.upcoming.tomorrow")}
          {" · "}
          {formatRange(new Date(o.startsAt), new Date(o.endsAt), format())}
        </span>
      </div>
      {o.canJoin ? (
        <Button
          size="sm"
          aria-label={t("meetings.upcoming.joinFor", { title: o.title })}
          onClick={() => onJoin(o.meetingId)}
        >
          {t("meetings.upcoming.join")}
        </Button>
      ) : null}
    </li>
  );
}

export function UpcomingMeetings({ workspaceId, onPreJoin, onViewCalendar, now }: UpcomingMeetingsProps) {
  const { t } = useTranslation();
  const at = useMemo(() => now ?? new Date(), [now]);
  const range = useMemo(() => upcomingRange(at), [at]);
  const calendar = useCalendar(workspaceId, range);
  const join = useJoinScheduled(onPreJoin);
  const list = upcomingOf(calendar.data?.occurrences ?? [], at);
  if (calendar.isPending) return <Spinner label={t("meetings.upcoming.loading")} />;
  if (calendar.isError && !calendar.data)
    return (
      <Notice tone="danger" action={{ label: t("meetings.upcoming.retry"), onClick: () => void calendar.refetch() }}>
        {t("meetings.upcoming.failed")}
      </Notice>
    );
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="upcoming-meetings" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-meetings" className="m-0 text-[17px] leading-6 font-[650] text-ink">
          {t("meetings.upcoming.title")}
        </h2>
        <Button variant="ghost" size="sm" onClick={onViewCalendar}>
          {t("meetings.upcoming.viewCalendar")}
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
        {list.map((o) => (
          <Row key={`${o.meetingId}|${o.originalStart}`} o={o} at={at} onJoin={join} />
        ))}
      </ul>
    </section>
  );
}

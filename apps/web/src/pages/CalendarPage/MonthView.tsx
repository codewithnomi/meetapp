// The Month view (approved "Calendar: Month" screen): a grid of days with up to 3 meetings each and
// "+N more" (AC-F13-01). A day's meetings, or "+N more", open like blocks in the week grid.
import { MeetingBlock, type GridDay } from "@meetapp/ui";
import { useTranslation } from "react-i18next";

const SHOWN = 3;

function MonthDay({ day, month, onOpen, onMore }: { day: GridDay } & Omit<MonthViewProps, "days">) {
  const { t } = useTranslation();
  const all = [...day.allDay, ...day.meetings];
  const hidden = all.slice(SHOWN);
  const tone = day.today
    ? "font-bold text-accent-text"
    : new Date(day.key).getMonth() === month
      ? "text-ink"
      : "text-ink-subtle";
  return (
    <li
      aria-label={day.fullLabel}
      className="flex min-h-24 min-w-0 flex-col gap-0.75 border-b border-l border-line p-1.5 text-[12px]"
    >
      <span className={tone}>{new Date(day.key).getDate()}</span>
      {all.slice(0, SHOWN).map((m) => (
        <MeetingBlock key={m.id} {...m} compact onOpen={() => onOpen(m.id)} />
      ))}
      {hidden.length > 0 ? (
        <button
          type="button"
          onClick={() => onMore(hidden.map((m) => m.id))}
          className="cursor-pointer self-start rounded-sm border-0 bg-transparent p-0 font-[inherit] text-[12px] font-semibold text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {t("calendar.more", { count: hidden.length })}
        </button>
      ) : null}
    </li>
  );
}

interface MonthViewProps {
  days: GridDay[];
  /** The month shown; other days are dimmed. */
  month: number;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
}

export function MonthView({
  days,
  month,
  onOpen,
  onMore,
}: {
  days: GridDay[];
  /** The month shown; other days are dimmed. */
  month: number;
  onOpen: (id: string) => void;
  onMore: (ids: string[]) => void;
}) {
  return (
    <ol className="m-0 grid flex-1 list-none grid-cols-7 p-0">
      {days.map((day) => (
        <MonthDay key={day.key} day={day} month={month} onOpen={onOpen} onMore={onMore} />
      ))}
    </ol>
  );
}

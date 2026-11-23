// The meetings behind "+N more" (AC-F13-01): a short list; choosing one opens its details.
import { Dialog, MeetingBlock } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { formatRange, type CalendarOccurrence, type TimeFormat } from "../../features/scheduling/index.ts";

export function MoreDialog({
  occurrences,
  format,
  onOpen,
  onClose,
}: {
  occurrences: CalendarOccurrence[];
  format: TimeFormat;
  onOpen: (o: CalendarOccurrence) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("calendar.moreTitle")}
      description={t("calendar.moreTitle")}
      hideDescription
      closeLabel={t("calendar.details.close")}
    >
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {occurrences.map((o) => {
          const time = o.allDay ? t("calendar.allDay") : formatRange(new Date(o.startsAt), new Date(o.endsAt), format);
          return (
            <li key={o.meetingId + o.originalStart} className="flex">
              <MeetingBlock
                title={o.title}
                time={time}
                state={o.myAnswer && o.myAnswer !== "none" ? o.myAnswer : "accepted"}
                stateLabel={o.organizer.name}
                repeats={o.repeats}
                onOpen={() => onOpen(o)}
                className="flex-1"
              />
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

// The meetings behind "+N more" (AC-F13-01), in words for the shared list dialog.
import { MeetingListDialog } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { formatRange, type CalendarOccurrence, type TimeFormat } from "../../features/scheduling/index.ts";

const idOf = (o: CalendarOccurrence) => o.meetingId + o.originalStart;

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
    <MeetingListDialog
      title={t("calendar.moreTitle")}
      closeLabel={t("calendar.details.close")}
      meetings={occurrences.map((o) => ({
        id: idOf(o),
        title: o.title,
        time: o.allDay ? t("calendar.allDay") : formatRange(new Date(o.startsAt), new Date(o.endsAt), format),
        state: o.myAnswer && o.myAnswer !== "none" ? o.myAnswer : "accepted",
        stateLabel: o.organizer.name,
        repeats: o.repeats,
      }))}
      onOpen={(id) => {
        const chosen = occurrences.find((o) => idOf(o) === id);
        if (chosen) onOpen(chosen);
      }}
      onClose={onClose}
    />
  );
}

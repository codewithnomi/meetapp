// The details of the meeting clicked in the calendar (F13 AC-F13-03, 05, 26, 27, 31): when and how it
// repeats, Join (5 minutes before until the end), the person's answer, the link, ID and passcode, who
// answered what (outside addresses only for organizers), and the notes. Edit and Cancel come in T11.
import { MeetingDetailsPanel, Spinner, type DetailsPerson } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { spacedMeetingNumber, useFindMeeting, type PreJoinState } from "../../features/meetings/index.ts";
import {
  formatRange,
  useAnswer,
  useScheduleDetails,
  type CalendarOccurrence,
  type InviteAnswer,
  type ScheduleDetails,
  type TimeFormat,
} from "../../features/scheduling/index.ts";

type Answer = Exclude<InviteAnswer, "none">;
const ANSWERS: Answer[] = ["accepted", "tentative", "declined"];

export interface DetailsPaneProps {
  occurrence: CalendarOccurrence;
  format: TimeFormat;
  online: boolean;
  onClose: () => void;
  onPreJoin: (state: PreJoinState) => void;
}

function whenLines(d: ScheduleDetails, o: CalendarOccurrence, format: TimeFormat, t: TFunction): string[] {
  const start = new Date(o.startsAt);
  const day = new Intl.DateTimeFormat(format.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: format.timeZone,
  }).format(start);
  const time = o.allDay ? t("calendar.allDay") : formatRange(start, new Date(o.endsAt), format);
  const lines = [`${day} · ${time}`];
  if (d.repeat.kind !== "none") {
    const repeat = t(`calendar.details.repeats.${d.repeat.kind}`);
    const until = d.repeat.until
      ? new Intl.DateTimeFormat(format.locale, { day: "numeric", month: "short", timeZone: format.timeZone }).format(
          new Date(d.repeat.until),
        )
      : undefined;
    lines.push(until ? t("calendar.details.until", { repeat, date: until }) : repeat);
  }
  return lines;
}

function peopleOf(d: ScheduleDetails, t: TFunction): { heading: string; list: DetailsPerson[] } {
  const count = (a: InviteAnswer) => d.invitees.filter((i) => i.answer === a).length;
  const list: DetailsPerson[] = [
    { key: d.organizer.id, name: d.organizer.name, answer: t("calendar.details.organizerTag") },
    ...d.invitees
      .filter((i) => i.member?.id !== d.organizer.id)
      .map((i) => ({
        key: i.id,
        name: i.member?.name ?? i.email ?? "",
        answer: i.member ? t(`calendar.states.${i.answer}`) : t("calendar.details.outside"),
      })),
  ];
  if (d.hiddenExternal > 0)
    list.push({ key: "hidden", name: t("calendar.details.hiddenOutside", { count: d.hiddenExternal }), answer: "" });
  return {
    heading: t("calendar.details.people", {
      accepted: count("accepted"),
      tentative: count("tentative"),
      declined: count("declined"),
      none: count("none"),
    }),
    list,
  };
}

function useJoin(link: string | undefined, onPreJoin: DetailsPaneProps["onPreJoin"]) {
  const find = useFindMeeting();
  return () => {
    if (!link) return;
    find.mutate(
      { link },
      { onSuccess: (m) => onPreJoin({ title: m.title, lookupToken: m.lookupToken, group: m.group, address: link }) },
    );
  };
}

export function DetailsPane({ occurrence, format, online, onClose, onPreJoin }: DetailsPaneProps) {
  const { t } = useTranslation();
  const details = useScheduleDetails(occurrence.meetingId);
  const answer = useAnswer(occurrence.meetingId);
  const join = useJoin(details.data?.link, onPreJoin);
  const d = details.data;
  if (!d) return <Spinner label={t("calendar.details.loading")} />;
  const mine = d.myAnswer;
  return (
    <MeetingDetailsPanel<Answer>
      title={d.title}
      closeLabel={t("calendar.details.close")}
      onClose={onClose}
      when={whenLines(d, occurrence, format, t)}
      join={occurrence.canJoin && !d.cancelled ? { label: t("calendar.details.join"), onClick: join } : undefined}
      answer={
        mine !== null && online
          ? {
              label: t("calendar.details.answerLabel"),
              options: ANSWERS.map((value) => ({ value, label: t(`calendar.details.answers.${value}`) })),
              value: mine === "none" ? ("" as Answer) : mine,
              onChange: (value) => answer.mutate({ answer: value, scope: "series" }),
            }
          : undefined
      }
      details={[
        { label: t("calendar.details.link"), value: d.link },
        { label: t("calendar.details.meetingId"), value: spacedMeetingNumber(d.meetingNumber), mono: true },
        { label: t("calendar.details.passcode"), value: d.passcode, mono: true },
      ]}
      people={peopleOf(d, t)}
      notes={d.description ? { label: t("calendar.details.notes"), text: d.description } : undefined}
      cancelledNote={d.cancelled ? t("calendar.details.cancelled") : undefined}
    />
  );
}

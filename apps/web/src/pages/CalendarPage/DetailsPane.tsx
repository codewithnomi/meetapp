// The details of the meeting clicked in the calendar (F13 AC-F13-03, 05, 26, 27, 31): when and how it
// repeats, Join (5 minutes before until the end), the person's answer, the link, ID and passcode, who
// answered what (outside addresses only for organizers), and the notes. Organizers can edit, cancel and
// send failed invites again (AC-F13-18, 20, 31); a repeating meeting asks "this one or the series" first.
import { MeetingDetailsPanel, Spinner, type DetailsPerson } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CancelDialog } from "./CancelDialog.tsx";
import { ScopeDialog, type Scope } from "./ScopeDialog.tsx";
import { spacedMeetingNumber, useFindMeeting, type PreJoinState } from "../../features/meetings/index.ts";
import {
  formatRange,
  useAnswer,
  useResendInvites,
  useScheduleDetails,
  type CalendarOccurrence,
  type InviteAnswer,
  type ScheduleDetails,
  type TimeFormat,
} from "../../features/scheduling/index.ts";

type Answer = Exclude<InviteAnswer, "none">;
const ANSWERS: Answer[] = ["accepted", "tentative", "declined"];

/** What to edit: the series, or one meeting of it. */
export interface CalendarEdit {
  meetingId: string;
  scope: Scope;
  occurrence?: { originalStart: string; startsAt: string; endsAt: string } | undefined;
}

export interface DetailsPaneProps {
  occurrence: CalendarOccurrence;
  format: TimeFormat;
  online: boolean;
  onClose: () => void;
  onPreJoin: (state: PreJoinState) => void;
  onEdit: (edit: CalendarEdit) => void;
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

type Asking = { kind: "edit" } | { kind: "answer"; answer: Answer } | { kind: "cancel" } | undefined;

/** Edit, Cancel and the answer; for a repeating meeting each first asks "This meeting / The series". */
function useActions(o: CalendarOccurrence, onEdit: DetailsPaneProps["onEdit"]) {
  const answer = useAnswer(o.meetingId);
  const [asking, setAsking] = useState<Asking>();
  const one = { originalStart: o.originalStart, startsAt: o.startsAt, endsAt: o.endsAt };
  const edit = (scope: Scope) =>
    onEdit({ meetingId: o.meetingId, scope, ...(scope === "occurrence" ? { occurrence: one } : {}) });
  const reply = (value: Answer, scope: Scope) =>
    answer.mutate({ answer: value, scope, ...(scope === "occurrence" ? { originalStart: o.originalStart } : {}) });
  const choose = (scope: Scope) => {
    if (asking?.kind === "edit") edit(scope);
    if (asking?.kind === "answer") reply(asking.answer, scope);
    setAsking(undefined);
  };
  return {
    asking,
    close: () => setAsking(undefined),
    choose,
    edit: () => (o.repeats ? setAsking({ kind: "edit" }) : edit("series")),
    answer: (value: Answer) => (o.repeats ? setAsking({ kind: "answer", answer: value }) : reply(value, "series")),
    cancel: () => setAsking({ kind: "cancel" }),
    answerFailed: answer.isError,
  };
}

function Dialogs({
  actions,
  occurrence,
  format,
}: {
  actions: ReturnType<typeof useActions>;
  occurrence: CalendarOccurrence;
  format: TimeFormat;
}) {
  const { asking, close, choose } = actions;
  if (!asking) return null;
  if (asking.kind === "cancel") {
    const day = new Intl.DateTimeFormat(format.locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: format.timeZone,
    }).format(new Date(occurrence.startsAt));
    return <CancelDialog occurrence={occurrence} day={day} onDone={close} onClose={close} />;
  }
  return <ScopeDialog kind={asking.kind} onChoose={choose} onClose={close} />;
}

function manageProps(
  d: ScheduleDetails,
  actions: ReturnType<typeof useActions>,
  { online, resend, t }: { online: boolean; resend: () => void; t: TFunction },
) {
  if (!d.canManage || d.cancelled || !online) return {};
  return {
    edit: { label: t("calendar.details.edit"), onClick: actions.edit },
    cancel: { label: t("calendar.details.cancel"), onClick: actions.cancel },
    unsent:
      d.unsentInvites > 0
        ? {
            text: t("calendar.details.unsent", { count: d.unsentInvites }),
            retry: { label: t("calendar.details.retry"), onClick: resend },
          }
        : undefined,
  };
}

export function DetailsPane({ occurrence, format, online, onClose, onPreJoin, onEdit }: DetailsPaneProps) {
  const { t } = useTranslation();
  const details = useScheduleDetails(occurrence.meetingId);
  const actions = useActions(occurrence, onEdit);
  const resend = useResendInvites(occurrence.meetingId);
  const join = useJoin(details.data?.link, onPreJoin);
  const d = details.data;
  if (!d) return <Spinner label={t("calendar.details.loading")} />;
  const mine = occurrence.myAnswer ?? d.myAnswer;
  return (
    <>
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
                onChange: actions.answer,
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
        {...manageProps(d, actions, { online, resend: () => resend.mutate(undefined), t })}
      />
      <Dialogs actions={actions} occurrence={occurrence} format={format} />
    </>
  );
}

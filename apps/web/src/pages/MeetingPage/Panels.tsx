// The side panels inside the call: Participants (everyone, raised hands first) and Meeting info (link,
// ID and passcode for anyone in the call, AC-F02-01). The lobby, the organizer's actions and Meeting
// options in these panels arrive with T15.
import { MeetingInfoPanel, ParticipantPanel } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  copyText,
  meetingInfo,
  spacedMeetingNumber,
  type CallPerson,
  type Joined,
} from "../../features/meetings/index.ts";
import type { Panel } from "./CallControls.tsx";
import { roleName, shownName } from "./names.ts";

function PeoplePanel({ people, onClose }: { people: CallPerson[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const found = query.trim().toLowerCase();
  const shown = people.filter((p) => found === "" || p.name.toLowerCase().includes(found));
  return (
    <ParticipantPanel
      title={t("meetings.call.peopleTitle", { count: people.length })}
      closeLabel={t("meetings.call.closePeople")}
      onClose={onClose}
      search={{ label: t("meetings.call.findPerson"), value: query, onChange: setQuery }}
      inMeetingTitle={t("meetings.call.inMeeting", { count: people.length })}
      noMatchText={t("meetings.call.noMatch")}
      people={shown.map((p) => ({
        id: p.id,
        name: shownName(t, p),
        roleLabel: roleName(t, p),
        speaking: p.speaking,
        speakingLabel: t("meetings.call.isSpeaking", { name: p.name }),
        handLabel: p.handRaisedAt ? t("meetings.call.handRaised") : undefined,
        micOn: p.micOn,
        micLabel: p.micOn ? t("meetings.call.micOnState") : t("meetings.call.muted"),
        cameraOn: p.cameraOn,
        cameraLabel: p.cameraOn ? t("meetings.call.cameraOnState") : t("meetings.call.cameraOffState"),
      }))}
    />
  );
}

function InfoPanel({ visit, onClose }: { visit: Joined; onClose: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>();
  const info = useQuery({ queryKey: ["call-meeting", visit.call?.callId], queryFn: () => meetingInfo(visit) });
  const meeting = info.data;
  if (!meeting) return null;
  const number = spacedMeetingNumber(meeting.meetingNumber);
  const copy = (text: string) =>
    void copyText(text).then((ok) => setStatus(ok ? t("meetings.call.copied") : t("meetings.ready.copyFailed")));
  const all = t("meetings.ready.allDetails", {
    title: meeting.title,
    link: meeting.link,
    id: number,
    passcode: meeting.passcode,
  });
  return (
    <MeetingInfoPanel
      title={t("meetings.call.info")}
      closeLabel={t("meetings.call.closeInfo")}
      onClose={onClose}
      link={{
        label: t("meetings.ready.link"),
        value: meeting.link,
        copyLabel: t("meetings.call.copy"),
        onCopy: () => copy(meeting.link),
      }}
      details={[
        { label: t("meetings.ready.meetingId"), value: number, mono: true },
        { label: t("meetings.ready.passcode"), value: meeting.passcode, mono: true },
        { label: t("meetings.call.organizer"), value: meeting.organizer.name },
      ]}
      copyAll={{ label: t("meetings.ready.copyAll"), onClick: () => copy(all) }}
      status={status}
    />
  );
}

export function Panels({
  panel,
  people,
  visit,
  onClose,
}: {
  panel: Panel;
  people: CallPerson[];
  visit: Joined;
  onClose: () => void;
}) {
  if (panel === "people") return <PeoplePanel people={people} onClose={onClose} />;
  if (panel === "info") return <InfoPanel visit={visit} onClose={onClose} />;
  return null;
}

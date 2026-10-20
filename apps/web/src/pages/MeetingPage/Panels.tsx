// The side panels inside the call (approved "Meeting" canvases): Participants, with the lobby on top for
// those who may let people in, Mute all, and each person's menu (AC-F02-15, 23, 33, 35, 36); and
// Meeting info (link, ID and passcode for anyone in the call, AC-F02-01) with Meeting options for the
// organizer and co-organizers.
import { MeetingInfoPanel, ParticipantPanel, SidePanel, Spinner } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { ApiError } from "../../features/api/index.ts";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import {
  copyText,
  meetingInfo,
  muteAll,
  spacedMeetingNumber,
  type CallPerson,
  type Joined,
  type MeetingDetails,
} from "../../features/meetings/index.ts";
import type { Panel } from "./CallControls.tsx";
import type { Lobby } from "./lobby.ts";
import { roleName, shownName } from "./names.ts";
import { personActions, type ActionContext } from "./person-actions.ts";

interface PeopleContext {
  people: CallPerson[];
  lobby: Lobby;
  canAdmit: boolean;
  canMuteAll: boolean;
  actions: ActionContext;
}

function lobbySection(t: TFunction, lobby: Lobby) {
  return {
    title: t("meetings.call.waitingTitle", { count: lobby.waiting.length }),
    admitAll: { label: t("meetings.call.admitAll"), onClick: () => lobby.decide("admit", { all: true }) },
    people: lobby.waiting.map((w) => {
      const name = w.group === "member" ? w.name : t(`meetings.call.${w.group}`, { name: w.name });
      return {
        id: w.attendanceId,
        name,
        admitText: t("meetings.call.admit"),
        denyText: t("meetings.call.deny"),
        admitLabel: t("meetings.call.admitNamed", { name }),
        denyLabel: t("meetings.call.denyNamed", { name }),
        onAdmit: () => lobby.decide("admit", { attendanceIds: [w.attendanceId] }),
        onDeny: () => lobby.decide("deny", { attendanceIds: [w.attendanceId] }),
      };
    }),
  };
}

function PeoplePanel({ context, onClose }: { context: PeopleContext; onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { people, lobby, canAdmit, canMuteAll, actions } = context;
  const found = query.trim().toLowerCase();
  const shown = people.filter((p) => found === "" || p.name.toLowerCase().includes(found));
  return (
    <ParticipantPanel
      title={t("meetings.call.peopleTitle", { count: people.length })}
      closeLabel={t("meetings.call.closePeople")}
      onClose={onClose}
      search={{ label: t("meetings.call.findPerson"), value: query, onChange: setQuery }}
      lobby={canAdmit ? lobbySection(t, lobby) : undefined}
      inMeetingTitle={t("meetings.call.inMeeting", { count: people.length })}
      muteAll={
        canMuteAll
          ? { label: t("meetings.call.muteAll"), onClick: () => void muteAll(actions.visit).catch(actions.onFailed) }
          : undefined
      }
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
        actions: personActions(p, actions),
        actionsLabel: t("meetings.call.actionsFor", { name: shownName(t, p) }),
      }))}
    />
  );
}

type InfoProps = { onClose: () => void; onOptions: ((meetingId: string) => void) | undefined };

function InfoDetails({ meeting, onClose, onOptions }: InfoProps & { meeting: MeetingDetails }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>();
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
      options={onOptions ? { label: t("meetings.ready.options"), onClick: () => onOptions(meeting.id) } : undefined}
      status={status}
    />
  );
}

/** Meeting info; while it loads, and when it fails (with Retry), the panel frame still shows (UI review). */
function InfoPanel({ visit, onClose, onOptions }: InfoProps & { visit: Joined }) {
  const { t } = useTranslation();
  const info = useQuery<MeetingDetails, ApiError>({
    queryKey: ["call-meeting", visit.call?.callId],
    queryFn: () => meetingInfo(visit),
  });
  if (info.data) return <InfoDetails meeting={info.data} onClose={onClose} onOptions={onOptions} />;
  return (
    <SidePanel title={t("meetings.call.info")} closeLabel={t("meetings.call.closeInfo")} onClose={onClose}>
      {info.isError ? (
        <ActionErrorNotice error={info.error} onRetry={() => void info.refetch()} />
      ) : (
        <Spinner label={t("meetings.call.loadingInfo")} />
      )}
    </SidePanel>
  );
}

export interface PanelsProps {
  panel: Panel;
  context: PeopleContext;
  onClose: () => void;
  /** Organizer and co-organizers: opens Meeting options. */
  onOptions: ((meetingId: string) => void) | undefined;
}

export function Panels({ panel, context, onClose, onOptions }: PanelsProps) {
  if (panel === "people") return <PeoplePanel context={context} onClose={onClose} />;
  if (panel === "info") return <InfoPanel visit={context.actions.visit} onClose={onClose} onOptions={onOptions} />;
  return null;
}

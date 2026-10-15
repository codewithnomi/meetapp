// MeetingPage (page): inside the meeting (approved "Meeting" canvases, AC-F02-12, 13, 20–24, 44). The
// stage (gallery of 16 a page, or speaker view), the control bar with shortcuts, the side panels, and
// announcements for screen readers. When the call drops or ends, the app asks the backend what
// happened (removed, ended, …) and shows that message.
import { MeetingLayout, MessageCard, SegmentedControl } from "@meetapp/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../../features/api/index.ts";
import {
  endMeeting,
  leaveMeeting,
  loadPrefs,
  raiseHand,
  useElapsed,
  useMeetingRoom,
  useMeetingShortcuts,
  useVisit,
  type Attendance,
  type Joined,
  type Reaction,
} from "../../features/meetings/index.ts";
import { CallControls, type Panel } from "./CallControls.tsx";
import { Panels } from "./Panels.tsx";
import { Stage } from "./Stage.tsx";
import { useCallEvents, usePeopleAnnouncements } from "./call-events.ts";

export interface MeetingPageProps {
  onLeft: () => void;
  onOutcome: (outcome: Attendance) => void;
}

/** After an unexpected disconnect: the backend says why (removed, ended, dropped). */
async function outcomeOf(visit: Joined): Promise<Attendance> {
  return apiRequest<Attendance>(`/api/v1/attendances/${visit.attendanceId}`, {
    headers: { "x-meeting-ticket": visit.ticket },
  }).catch(() => ({ ...visit, status: "left" as const, leftReason: "dropped" as const }));
}

/** The call and what the person can do in it: devices, hand, shortcuts, leaving. */
function useCall(visit: Joined, { onLeft, onOutcome }: MeetingPageProps) {
  const [prefs] = useState(loadPrefs);
  const leaving = useRef(false);
  const events = useCallEvents();
  const end = useVisit((state) => state.end);
  const finish = (go: () => void) => (end(), go());
  const room = useMeetingRoom(visit, prefs, {
    onReaction: events.showReaction,
    onControl: events.onControl,
    onDisconnected: () => {
      if (!leaving.current) void outcomeOf(visit).then((outcome) => finish(() => onOutcome(outcome)));
    },
  });
  usePeopleAnnouncements(room.people, events.announcer.announce);
  const me = room.people.find((p) => p.isYou);
  const actions = {
    microphone: () => void room.setMicrophone(!(me?.micOn ?? false)).catch(() => undefined),
    camera: () => void room.setCamera(!(me?.cameraOn ?? false)).catch(() => undefined),
    hand: () => void raiseHand(visit, !me?.handRaisedAt).catch(() => undefined),
    react: (reaction: Reaction) =>
      void room.sendReaction(reaction).then(() => events.showReaction(visit.attendanceId, reaction)),
    leave: () => {
      leaving.current = true;
      void leaveMeeting(visit).then(() => finish(onLeft));
    },
    end: () => void endMeeting(visit).catch(() => undefined),
  };
  useMeetingShortcuts((shortcut) => actions[shortcut]());
  return { room, me, events, actions };
}

function LayoutSwitch({
  value,
  onChange,
}: {
  value: "gallery" | "speaker";
  onChange: (value: "gallery" | "speaker") => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      label={t("meetings.call.layout")}
      value={value}
      onChange={onChange}
      options={[
        { value: "gallery", label: t("meetings.call.gallery") },
        { value: "speaker", label: t("meetings.call.speaker") },
      ]}
    />
  );
}

function MutedNotice({ by, onDismiss }: { by: string | undefined; onDismiss: () => void }) {
  const { t } = useTranslation();
  if (!by) return null;
  return (
    <MessageCard
      icon="mic-off"
      tone="neutral"
      live="polite"
      className="max-w-100"
      title={t("meetings.call.mutedYou", { name: by })}
      body={t("meetings.call.mutedYouBody")}
      primary={{ label: t("meetings.call.dismiss"), onClick: onDismiss }}
    />
  );
}

function Call(props: MeetingPageProps & { visit: Joined }) {
  const { visit } = props;
  const { room, me, events, actions } = useCall(visit, props);
  const elapsed = useElapsed();
  const [layout, setLayout] = useState<"gallery" | "speaker">("gallery");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Panel>();
  return (
    <MeetingLayout
      title={visit.title}
      layoutSwitch={<LayoutSwitch value={layout} onChange={setLayout} />}
      notices={events.mutedBy ? <MutedNotice by={events.mutedBy} onDismiss={events.clearMutedBy} /> : undefined}
      stage={
        <Stage
          people={room.people}
          layout={layout}
          page={page}
          onPage={setPage}
          pinnedId={undefined}
          onUnpin={() => undefined}
          reactions={events.reactions}
        />
      }
      panel={<Panels panel={panel} people={room.people} visit={visit} onClose={() => setPanel(undefined)} />}
      controls={
        <CallControls
          me={me}
          may={room.may}
          elapsed={elapsed}
          count={room.people.length}
          panel={panel}
          onPanel={setPanel}
          onMicrophone={actions.microphone}
          onCamera={actions.camera}
          onHand={actions.hand}
          onReaction={actions.react}
          onLeave={actions.leave}
          onEnd={actions.end}
        />
      }
      announcement={events.announcer.current}
    />
  );
}

export function MeetingPage({ onLeft, onOutcome }: MeetingPageProps) {
  const visit = useVisit((state) => state.visit);
  if (!visit?.call) return null;
  return <Call visit={visit} onLeft={onLeft} onOutcome={onOutcome} />;
}

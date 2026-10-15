// MeetingPage (page): inside the meeting (approved "Meeting" canvases, AC-F02-12, 13, 20–24, 44). The
// stage (gallery of 16 a page, or speaker view), the control bar with shortcuts, the side panels, and
// announcements for screen readers. When the call drops or ends, the app asks the backend what
// happened (removed, ended, …) and shows that message.
import { MeetingLayout, SegmentedControl, type LobbyBar } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../../features/api/index.ts";
import {
  MeetingOptionsDialog,
  can,
  endMeeting,
  hasSharePicker,
  leaveMeeting,
  setLocked,
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
import { EndDialog } from "./EndDialog.tsx";
import { useLobby } from "./lobby.ts";
import { Notices } from "./Notices.tsx";
import { ShareDialog } from "./ShareDialog.tsx";

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

/** The call and what the person can do in it: devices, hand, sharing, shortcuts, leaving. */
function useCall(visit: Joined, { onLeft, onOutcome }: MeetingPageProps) {
  const [prefs] = useState(loadPrefs);
  const leaving = useRef(false);
  const stopSharing = useRef(() => undefined as unknown);
  const lobbyRefresh = useRef(() => undefined as unknown);
  const events = useCallEvents({
    shareReplaced: () => stopSharing.current(),
    lobbyChanged: () => lobbyRefresh.current(),
  });
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
  const lobby = useLobby(visit, can(me?.role, "admit"), events.announcer.announce);
  // The server's messages reach the newest share and lobby functions (set after each render).
  useEffect(() => {
    stopSharing.current = room.stopShare;
    lobbyRefresh.current = lobby.refresh;
  });
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
  return { room, me, events, actions, lobby };
}

type Dialog = { kind: "share" } | { kind: "end" } | { kind: "options"; meetingId: string } | undefined;

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

type CallState = ReturnType<typeof useCall> & { visit: Joined };

/** The lobby bar over the stage, for those who may let people in (approved "Meeting: gallery"). */
function lobbyBar(t: TFunction, call: CallState, openPeople: () => void): LobbyBar | undefined {
  const { waiting, decide } = call.lobby;
  if (waiting.length === 0) return undefined;
  const names = waiting.map((w) => (w.group === "member" ? w.name : t(`meetings.call.${w.group}`, { name: w.name })));
  return {
    label: t("meetings.call.lobby"),
    title: t("meetings.call.waitingBar", { count: waiting.length }),
    names: names.join(", "),
    view: { label: t("meetings.call.viewLobby"), onClick: openPeople },
    admitAll: { label: t("meetings.call.admitAll"), onClick: () => decide("admit", { all: true }) },
  };
}

function Overlays({ dialog, call, onClose }: { dialog: Dialog; call: CallState; onClose: () => void }) {
  if (dialog?.kind === "share")
    return <ShareDialog onShare={(id) => (onClose(), void call.room.share(id))} onClose={onClose} />;
  if (dialog?.kind === "end") return <EndDialog onEnd={() => (onClose(), call.actions.end())} onClose={onClose} />;
  if (dialog?.kind === "options") {
    const lock = {
      checked: call.room.state.locked,
      onChange: (locked: boolean) => void setLocked(call.visit, locked).catch(() => undefined),
    };
    return (
      <MeetingOptionsDialog meetingId={dialog.meetingId} open onOpenChange={(open) => !open && onClose()} lock={lock} />
    );
  }
  return null;
}

function useView() {
  const [layout, setLayout] = useState<"gallery" | "speaker">("gallery");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Panel>();
  const [pinnedId, setPinnedId] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  const [failed, setFailed] = useState(false);
  return {
    layout,
    setLayout,
    page,
    setPage,
    panel,
    setPanel,
    pinnedId,
    setPinnedId,
    dialog,
    setDialog,
    failed,
    setFailed,
  };
}

/** Everything the screen shows, from the call and the view's own state. */
function useScreen(props: MeetingPageProps & { visit: Joined }) {
  const { t } = useTranslation();
  const { visit } = props;
  const call: CallState = { ...useCall(visit, props), visit };
  const { room, me } = call;
  const view = useView();
  const context = {
    people: room.people,
    lobby: call.lobby,
    canAdmit: can(me?.role, "admit"),
    canMuteAll: can(me?.role, "mute"),
    actions: { t, visit, me, pinnedId: view.pinnedId, onPin: view.setPinnedId, onFailed: () => view.setFailed(true) },
  };
  const share = () => {
    if (me?.screen) void room.stopShare();
    else if (hasSharePicker()) view.setDialog({ kind: "share" });
    else void room.share(undefined);
  };
  const onOptions = can(me?.role, "options")
    ? (meetingId: string) => view.setDialog({ kind: "options", meetingId })
    : undefined;
  return { t, call, view, context, share, onOptions, elapsed: useElapsed() };
}

type Screen = ReturnType<typeof useScreen>;

function Controls({ screen }: { screen: Screen }) {
  const { call, view, share, elapsed } = screen;
  const { room, me, actions } = call;
  return (
    <CallControls
      me={me}
      may={room.may}
      elapsed={elapsed}
      count={room.people.length}
      panel={view.panel}
      onPanel={view.setPanel}
      onMicrophone={actions.microphone}
      onCamera={actions.camera}
      onHand={actions.hand}
      onReaction={actions.react}
      onShare={share}
      onLeave={actions.leave}
      onEnd={() => view.setDialog({ kind: "end" })}
    />
  );
}

function Call(props: MeetingPageProps & { visit: Joined }) {
  const screen = useScreen(props);
  const { t, call, view, context, onOptions } = screen;
  const { room, events, actions, visit } = call;
  return (
    <>
      <MeetingLayout
        title={visit.title}
        layoutSwitch={<LayoutSwitch value={view.layout} onChange={view.setLayout} />}
        lobby={context.canAdmit ? lobbyBar(t, call, () => view.setPanel("people")) : undefined}
        notices={
          <Notices
            notice={events.notice}
            failed={view.failed}
            onUnmute={actions.microphone}
            onDismiss={events.clearNotice}
            onDismissFailed={() => view.setFailed(false)}
          />
        }
        stage={
          <Stage
            people={room.people}
            layout={view.layout}
            page={view.page}
            onPage={view.setPage}
            pinnedId={view.pinnedId}
            onUnpin={() => view.setPinnedId(undefined)}
            reactions={events.reactions}
          />
        }
        panel={
          <Panels panel={view.panel} context={context} onClose={() => view.setPanel(undefined)} onOptions={onOptions} />
        }
        controls={<Controls screen={screen} />}
        announcement={events.announcer.current}
      />
      <Overlays dialog={view.dialog} call={call} onClose={() => view.setDialog(undefined)} />
    </>
  );
}

export function MeetingPage({ onLeft, onOutcome }: MeetingPageProps) {
  const visit = useVisit((state) => state.visit);
  if (!visit?.call) return null;
  return <Call visit={visit} onLeft={onLeft} onOutcome={onOutcome} />;
}

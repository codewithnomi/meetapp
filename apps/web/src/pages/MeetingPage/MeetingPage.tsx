// MeetingPage (page): inside the meeting (approved "Meeting" canvases, AC-F02-12, 13, 20–24, 44). The
// stage (gallery of 16 a page, or speaker view), the control bar with shortcuts, the side panels, and
// announcements for screen readers. When the call drops or ends, the app asks the backend what
// happened (removed, ended, …) and shows that message.
import { MeetingLayout, SegmentedControl, type LobbyBar } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import {
  MeetingOptionsDialog,
  can,
  hasSharePicker,
  setLocked,
  useElapsed,
  useVisit,
  type Joined,
} from "../../features/meetings/index.ts";
import { CallControls, type Panel } from "./CallControls.tsx";
import { useAttachments } from "./chat-attachments.ts";
import { ChatArea } from "./ChatArea.tsx";
import { useFileDrop } from "./file-drop.ts";
import { Panels } from "./Panels.tsx";
import { Stage } from "./Stage.tsx";
import { DevicesPanel } from "./DevicesPanel.tsx";
import { EndDialog } from "./EndDialog.tsx";
import { Notices } from "./Notices.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { useCall, type CallState, type MeetingPageProps } from "./use-call.ts";

export type { MeetingPageProps };

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
  const { setOpen } = call.chat;
  const files = useAttachments(visit);
  const canAttach = call.me !== undefined && call.me.group !== "guest";
  const dropping = useFileDrop(
    canAttach,
    (dropped) => (view.setPanel("chat"), files.add(dropped)),
    () => view.setPanel("chat"),
  );
  // While the chat is open, nothing counts as unread (AC-F03-07).
  useEffect(() => setOpen(view.panel === "chat"), [setOpen, view.panel]);
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
  return { t, call, view, context, share, onOptions, files, dropping };
}

type Screen = ReturnType<typeof useScreen>;

/** The control bar; only it redraws every second for the clock (not the whole call, UI review). */
function Controls({ screen }: { screen: Screen }) {
  const { call, view, share } = screen;
  const elapsed = useElapsed();
  const { room, me, actions } = call;
  return (
    <CallControls
      me={me}
      may={room.may}
      elapsed={elapsed}
      count={room.people.length}
      unread={call.chat.state.unread}
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

function ScreenNotices({ screen }: { screen: Screen }) {
  const { call, view } = screen;
  const { events, actions, room, care } = call;
  return (
    <Notices
      notice={events.notice}
      failed={view.failed}
      connecting={room.connection === "connecting"}
      reconnecting={room.connection === "reconnecting"}
      gone={care.gone}
      onUnmute={actions.microphone}
      onDismiss={events.clearNotice}
      onDismissFailed={() => view.setFailed(false)}
      onDismissGone={care.clearGone}
    />
  );
}

function ScreenStage({ screen }: { screen: Screen }) {
  const { call, view } = screen;
  return (
    <Stage
      people={call.room.people}
      layout={view.layout}
      page={view.page}
      onPage={view.setPage}
      pinnedId={view.pinnedId}
      onUnpin={() => view.setPinnedId(undefined)}
      reactions={call.events.reactions}
      ownWeak={call.care.ownWeak}
    />
  );
}

function ScreenPanel({ screen }: { screen: Screen }) {
  const { call, view, context, onOptions } = screen;
  const close = () => view.setPanel(undefined);
  if (view.panel === "devices")
    return (
      <DevicesPanel
        room={call.room.room}
        prefs={call.prefs}
        setPrefs={call.setPrefs}
        weak={call.care.ownWeak}
        onClose={close}
      />
    );
  if (view.panel === "chat") {
    const role = call.me?.role;
    const rights = {
      moderate: role === "organizer" || role === "co_organizer",
      createPoll: role !== undefined && role !== "attendee",
      attach: call.me !== undefined && call.me.group !== "guest",
    };
    const onFailed = () => view.setFailed(true);
    return (
      <ChatArea
        chat={call.chat}
        writing={{ visit: call.visit, attachments: screen.files, off: call.room.state.options?.chatMode === "off" }}
        dropping={screen.dropping && rights.attach}
        rights={rights}
        onClose={close}
        onFailed={onFailed}
      />
    );
  }
  return <Panels panel={view.panel} context={context} onClose={close} onOptions={onOptions} />;
}

function Call(props: MeetingPageProps & { visit: Joined }) {
  const screen = useScreen(props);
  const { t, call, view, context } = screen;
  return (
    <>
      <MeetingLayout
        title={call.visit.title}
        layoutSwitch={<LayoutSwitch value={view.layout} onChange={view.setLayout} />}
        lobby={context.canAdmit ? lobbyBar(t, call, () => view.setPanel("people")) : undefined}
        notices={<ScreenNotices screen={screen} />}
        stage={<ScreenStage screen={screen} />}
        panel={<ScreenPanel screen={screen} />}
        controls={<Controls screen={screen} />}
        announcement={call.events.announcer.current}
      />
      <Overlays dialog={view.dialog} call={call} onClose={() => view.setDialog(undefined)} />
    </>
  );
}

export function MeetingPage({ onLeft, onOutcome }: MeetingPageProps) {
  const visit = useVisit((state) => state.visit);
  // Opened without a visit (e.g. the screen was reloaded): back to the start. A visit that ends here
  // (left, removed, ended) shows nothing while the app moves on to its message.
  const [openedWithVisit] = useState(() => Boolean(visit?.call));
  if (!visit?.call) return openedWithVisit ? null : <Navigate to="/" replace />;
  return <Call visit={visit} onLeft={onLeft} onOutcome={onOutcome} />;
}

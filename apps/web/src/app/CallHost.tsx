// F17's call host (design.md 3.1, 3.2; D091): the lobby, the meeting or the chat call stays mounted for as
// long as the person is in it, whatever screen they open. On its own path it shows full; elsewhere it is
// hidden (still running: sound, panels and layout stay) and the small call view shows at the bottom right.
// The pages' callbacks move between screens only while the call is full; a call that ends while hidden
// leaves the person where they are, with a banner saying what happened (and Rejoin after a lost connection).
import { Notice, SmallCallView } from "@meetapp/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { useCallCorner } from "../features/call-corner/index.ts";
import { LeaveFirstDialog, useCallScreen, useSmallCallView } from "../features/call-windows/index.ts";
import { cancelRing, inCallNow, useCallOutcome, useChatCall, useCurrentCall } from "../features/calls/index.ts";
import { leaveMeeting, outcomeOf, useRejoin, useVisit, type Attendance } from "../features/meetings/index.ts";
import { CallNavRail, type AppScreen } from "../features/workspaces/index.ts";
import { ChatCallPage } from "../pages/ChatCallPage/index.ts";
import { LobbyPage } from "../pages/LobbyPage/index.ts";
import { MeetingPage } from "../pages/MeetingPage/index.ts";

const HOME = "/meetings";
/** Statuses a lobby visit may move to without having ended. */
const STILL_IN = new Set(["waiting", "admitted", "in_call"]);
/** Where the call shows full. All of them: on being let in, the lobby's path still shows until it moves on. */
const CALL_PATHS = new Set(["/meeting/lobby", "/meeting/call", "/call"]);

/** Callbacks for the hosted page: they move between screens only while the call shows full. */
function useMoves(full: boolean) {
  const navigate = useNavigate();
  const keep = useCallOutcome((state) => state.set);
  const only = (move: () => void) => () => (full ? move() : undefined);
  return {
    toCall: only(() => void navigate("/meeting/call")),
    toHome: only(() => void navigate(HOME)),
    toChat: only(() => void navigate("/chat")),
    outcome: (outcome: Attendance) => (full ? void navigate("/meeting/ended", { state: outcome }) : keep(outcome)),
  };
}

function Hosted({ full, userName }: { full: boolean; userName: string }) {
  const moves = useMoves(full);
  const chat = useChatCall((state) => state.call);
  const visit = useVisit((state) => state.visit);
  if (chat) return <ChatCallPage hosted onBackToChat={moves.toChat} onOutcome={moves.outcome} />;
  if (visit?.status === "waiting")
    return (
      <LobbyPage
        name={userName}
        previewOn={full}
        onAdmitted={moves.toCall}
        onOutcome={moves.outcome}
        onLeft={moves.toHome}
      />
    );
  return <MeetingPage hosted onLeft={moves.toHome} onOutcome={moves.outcome} />;
}

/** What happened to a call that ended while another screen showed (AC-F17-06). */
function OutcomeBanner() {
  const { t } = useTranslation();
  const outcome = useCallOutcome((state) => state.outcome);
  const { set, clear } = useCallOutcome();
  const visit = useVisit((state) => state.visit);
  const end = useVisit((state) => state.end);
  const rejoin = useRejoin();
  if (!outcome) return null;
  const which = outcomeOf(outcome);
  // Ends only the visit this outcome belongs to, never a newer call (verify, bug H1).
  const dismiss = () => {
    if (visit?.attendanceId === outcome.attendanceId) end();
    clear();
  };
  const again = () =>
    visit &&
    rejoin.mutate(visit, {
      onSuccess: (back) => (back.status === "admitted" || back.status === "waiting" ? clear() : set(back)),
    });
  return (
    <div className="fixed top-4 left-1/2 z-40 w-[min(560px,calc(100%-32px))] -translate-x-1/2">
      <Notice
        tone={which === "lost" || which === "removed" ? "danger" : "neutral"}
        icon={which === "lost" ? "signal" : "info"}
        title={t(`meetings.ended.${which}.title`)}
        action={
          // Rejoin only the call this outcome belongs to, never a newer one (re-check, M-B).
          which === "lost" && visit?.attendanceId === outcome.attendanceId && !rejoin.isPending
            ? { label: t("meetings.ended.rejoin"), onClick: again }
            : { label: t("meetings.call.dismiss"), onClick: dismiss }
        }
      >
        {t(`meetings.ended.${which}.body`, { name: outcome.actedByName ?? t("meetings.ended.someone") })}
      </Notice>
    </div>
  );
}

/** The call screen's own Leave; before it has shown its buttons, the call is ended directly (verify, M1). */
function leaveNow() {
  const controls = useCallScreen.getState().controls;
  if (controls) return controls.leave();
  // A chat call still ringing stops ringing the others too, as its Cancel does.
  const chat = useChatCall.getState().call;
  if (chat?.phase === "ringing") void cancelRing(chat.callId).catch(() => undefined);
  void leaveMeeting(useVisit.getState().visit);
  useChatCall.getState().end();
  useVisit.getState().end();
}

/**
 * What the host keeps up besides drawing: leave first and sign-out (AC-F17-09, 12, 16) ask the calls' own
 * stores through one shared helper; a declined or unanswered chat call left behind on another screen
 * closes, as its Close does (verify, bug H3).
 */
function useHostUpkeep(finished: boolean) {
  const register = useCallCorner((state) => state.register);
  useEffect(() => {
    register({ inCall: inCallNow, leave: leaveNow });
    return () => register(undefined);
  }, [register]);
  useEffect(() => {
    if (!finished) return;
    void leaveMeeting(useVisit.getState().visit);
    useChatCall.getState().end();
    useVisit.getState().end();
  }, [finished]);
}

/**
 * A lobby that ends (denied, timed out, removed) stops being the current call before the lobby page could
 * report it, so the host reports it: the Ended screen if the lobby showed full, a banner otherwise (verify,
 * bug H2).
 */
function useLobbyEnding() {
  const { pathname } = useLocation();
  const moves = useMoves(CALL_PATHS.has(pathname));
  const status = useVisit((state) => state.visit?.status);
  const was = useRef(status);
  useEffect(() => {
    const before = was.current;
    was.current = status;
    const visit = useVisit.getState().visit;
    if (before === "waiting" && visit && !STILL_IN.has(visit.status)) moves.outcome(visit);
  });
}

export function CallHost({ userName, onNavigate }: { userName: string; onNavigate: (screen: AppScreen) => void }) {
  const current = useCurrentCall();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const full = current !== undefined && CALL_PATHS.has(pathname);
  const small = useSmallCallView(() => current && void navigate(current.fullPath));
  const shown = current !== undefined && !full && small !== undefined;
  const setCorner = useCallCorner((state) => state.set);
  useEffect(() => setCorner(shown), [setCorner, shown]);
  useHostUpkeep(current !== undefined && !current.live && !full);
  useLobbyEnding();
  // Let in while the lobby shows full: the host already shows the call, so its path follows.
  const fullPath = current?.fullPath;
  useEffect(() => {
    if (full && fullPath && pathname !== fullPath) void navigate(fullPath, { replace: true });
  }, [full, fullPath, pathname, navigate]);
  return (
    <>
      {current ? (
        // Hidden and inert while another screen shows: still running, out of the way of keyboard and clicks.
        // Full, the side menu shows beside the call, as in Teams (approved board): any screen is one click
        // away. The call stays in the same place in the page either way, so it is never rebuilt.
        <div data-call-host="" hidden={!full} inert={!full} className="flex">
          {full ? <CallNavRail onNavigate={onNavigate} /> : null}
          <div className="min-w-0 flex-1">
            <Hosted full={full} userName={userName} />
          </div>
        </div>
      ) : null}
      {shown ? (
        <div className="fixed right-4 bottom-4 z-30">
          <SmallCallView {...small} />
        </div>
      ) : null}
      <OutcomeBanner />
      <LeaveFirstDialog />
    </>
  );
}

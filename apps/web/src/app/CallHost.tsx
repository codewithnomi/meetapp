// F17's call host (design.md 3.1, 3.2; D091): the lobby, the meeting or the chat call stays mounted for as
// long as the person is in it, whatever screen they open. On its own path it shows full; elsewhere it is
// hidden (still running: sound, panels and layout stay) and the small call view shows at the bottom right.
// The pages' callbacks move between screens only while the call is full; a call that ends while hidden
// leaves the person where they are, with a banner saying what happened (and Rejoin after a lost connection).
import { Notice, SmallCallView } from "@meetapp/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { useCallCorner } from "../features/call-corner/index.ts";
import { useSmallCallView } from "../features/call-windows/index.ts";
import { useCallOutcome, useChatCall, useCurrentCall } from "../features/calls/index.ts";
import { outcomeOf, useRejoin, useVisit, type Attendance } from "../features/meetings/index.ts";
import { ChatCallPage } from "../pages/ChatCallPage/index.ts";
import { LobbyPage } from "../pages/LobbyPage/index.ts";
import { MeetingPage } from "../pages/MeetingPage/index.ts";

const HOME = "/meetings";
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
  const dismiss = () => (clear(), end());
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
          which === "lost" && visit && !rejoin.isPending
            ? { label: t("meetings.ended.rejoin"), onClick: again }
            : { label: t("meetings.call.dismiss"), onClick: dismiss }
        }
      >
        {t(`meetings.ended.${which}.body`, { name: outcome.actedByName ?? t("meetings.ended.someone") })}
      </Notice>
    </div>
  );
}

export function CallHost({ userName }: { userName: string }) {
  const current = useCurrentCall();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const full = current !== undefined && CALL_PATHS.has(pathname);
  const small = useSmallCallView(() => current && void navigate(current.fullPath));
  const shown = current !== undefined && !full && small !== undefined;
  const setCorner = useCallCorner((state) => state.set);
  useEffect(() => setCorner(shown), [setCorner, shown]);
  // Let in while the lobby shows full: the host already shows the call, so its path follows.
  const fullPath = current?.fullPath;
  useEffect(() => {
    if (full && fullPath && pathname !== fullPath) void navigate(fullPath, { replace: true });
  }, [full, fullPath, pathname, navigate]);
  return (
    <>
      {current ? (
        // Hidden and inert while another screen shows: still running, out of the way of keyboard and clicks.
        <div data-call-host="" hidden={!full} inert={!full}>
          <Hosted full={full} userName={userName} />
        </div>
      ) : null}
      {shown ? (
        <div className="fixed right-4 bottom-4 z-30">
          <SmallCallView {...small} />
        </div>
      ) : null}
      <OutcomeBanner />
    </>
  );
}

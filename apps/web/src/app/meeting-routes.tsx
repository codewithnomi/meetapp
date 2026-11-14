// The routes of a visit to a meeting (F02): pre-join, lobby, the call and how it ended. Guests get the
// screens on their own paths; for signed-in people the call host shows the lobby and the call (F17 D091).
import { useTranslation } from "react-i18next";
import { Navigate, Route, useLocation, useNavigate } from "react-router";
import { useCallOutcome, useCurrentCall } from "../features/calls/index.ts";
import {
  meetingErrorText,
  useRejoin,
  useVisit,
  type Attendance,
  type Joined,
  type PreJoinState,
} from "../features/meetings/index.ts";
import { LobbyPage } from "../pages/LobbyPage/index.ts";
import { MeetingEndedPage } from "../pages/MeetingEndedPage/index.ts";
import { MeetingPage } from "../pages/MeetingPage/index.ts";
import { PreJoinPage } from "../pages/PreJoinPage/index.ts";

/** Where a visit goes back to, and where Join a meeting is: for guests, and for signed-in people. */
export const GUEST_PLACES = { home: "/sign-in", join: "/join-meeting" };
export const MEMBER_PLACES = { home: "/meetings", join: "/meetings" };

/** A visit to a meeting, signed in or as a guest (F02): pre-join, lobby, the call, and how it ended. */
export function meetingRoutes({ home, join, userName }: { home: string; join: string; userName: string | undefined }) {
  return [
    <Route key="pre-join" path="/meeting/pre-join" element={<PreJoinRoute back={join} userName={userName} />} />,
    <Route key="lobby" path="/meeting/lobby" element={<LobbyRoute home={home} userName={userName} />} />,
    <Route key="call" path="/meeting/call" element={<CallRoute home={home} />} />,
    <Route key="ended" path="/meeting/ended" element={<EndedRoute home={home} join={join} />} />,
  ];
}

/**
 * F17: for signed-in people the call host shows the lobby and the call (design.md 3.1); their paths only
 * say "show it full". Without a call they lead back to Meetings.
 */
export function CallPlace() {
  const current = useCurrentCall();
  const ended = useCallOutcome((state) => state.outcome !== undefined);
  return current || ended ? null : <Navigate to="/meetings" replace />;
}

export function memberMeetingRoutes({
  home,
  join,
  userName,
}: {
  home: string;
  join: string;
  userName: string | undefined;
}) {
  return [
    <Route key="pre-join" path="/meeting/pre-join" element={<PreJoinRoute back={join} userName={userName} />} />,
    <Route key="lobby" path="/meeting/lobby" element={<CallPlace />} />,
    <Route key="call" path="/meeting/call" element={<CallPlace />} />,
    <Route key="ended" path="/meeting/ended" element={<EndedRoute home={home} join={join} />} />,
  ];
}

/** Where a join answer leads: in, the lobby, or the outcome. */
function useAfterJoin() {
  const navigate = useNavigate();
  return (visit: Joined) => {
    if (visit.status === "admitted") void navigate("/meeting/call");
    else if (visit.status === "waiting") void navigate("/meeting/lobby");
    else void navigate("/meeting/ended", { state: visit });
  };
}

function PreJoinRoute({ back, userName }: { back: string; userName: string | undefined }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <PreJoinPage
      meeting={location.state as PreJoinState | undefined}
      userName={userName}
      onCancel={() => void navigate(back)}
      onJoined={useAfterJoin()}
    />
  );
}

function LobbyRoute({ home, userName }: { home: string; userName: string | undefined }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <LobbyPage
      name={userName ?? t("meetings.preJoin.you")}
      onAdmitted={() => void navigate("/meeting/call")}
      onOutcome={(visit) => void navigate("/meeting/ended", { state: visit })}
      onLeft={() => void navigate(home)}
    />
  );
}

function CallRoute({ home }: { home: string }) {
  const navigate = useNavigate();
  return (
    <MeetingPage
      onLeft={() => void navigate(home)}
      onOutcome={(outcome) => void navigate("/meeting/ended", { state: outcome })}
    />
  );
}

function EndedRoute({ home, join }: { home: string; join: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const visit = useVisit((state) => state.visit);
  const end = useVisit((state) => state.end);
  const rejoin = useRejoin();
  const afterJoin = useAfterJoin();
  const go = (path: string) => (end(), void navigate(path));
  const text = rejoin.error ? meetingErrorText(rejoin.error.code, rejoin.error.retryAfterSeconds) : undefined;
  return (
    <MeetingEndedPage
      outcome={location.state as Attendance | undefined}
      onHome={() => go(home)}
      onTryAgain={() => go(join)}
      rejoin={
        visit
          ? {
              onRejoin: () => rejoin.mutate(visit, { onSuccess: afterJoin }),
              pending: rejoin.isPending,
              error: text ? t(text.key, text.values ?? {}) : undefined,
            }
          : undefined
      }
    />
  );
}

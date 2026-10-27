// The screens and when each one shows (F01 design.md section 1): signed out, the sign-in screens; signed
// in but the terms not yet accepted, only Terms; signed in, the app. The desktop app has no address
// bar, so the routes live in memory. After a screen change, focus moves to the new screen's title.
import { Notice, Spinner } from "@meetapp/ui";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { useAccountLook } from "../features/appearance/index.ts";
import { errorText, useSession } from "../features/auth/index.ts";
import type { SettingsScreen } from "../features/profile/index.ts";
import { CurrentWorkspaceProvider, useCurrentWorkspace, type AppScreen } from "../features/workspaces/index.ts";
import { BrowserSignInPage } from "../pages/BrowserSignInPage/index.ts";
import { CodePage } from "../pages/CodePage/index.ts";
import { CreateAccountPage } from "../pages/CreateAccountPage/index.ts";
import { IncomingCalls, OtherDevice } from "../features/calls/index.ts";
import { LiveLineProvider } from "../features/chats/index.ts";
import { ChatCallPage } from "../pages/ChatCallPage/index.ts";
import { ChatsPage } from "../pages/ChatsPage/index.ts";
import { HomePage } from "../pages/HomePage/index.ts";
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
import { JoinMeetingPage } from "../pages/JoinMeetingPage/index.ts";
import { JoinWorkspacePage } from "../pages/JoinWorkspacePage/index.ts";
import { MeetingsPage } from "../pages/MeetingsPage/index.ts";
import { NewPasswordPage } from "../pages/NewPasswordPage/index.ts";
import { PeoplePage } from "../pages/PeoplePage/index.ts";
import { WorkspaceSettingsPage } from "../pages/WorkspaceSettingsPage/index.ts";
import { PreJoinPage } from "../pages/PreJoinPage/index.ts";
import { RequestsPage } from "../pages/RequestsPage/index.ts";
import { SignInPage } from "../pages/SignInPage/index.ts";
import { TermsPage } from "../pages/TermsPage/index.ts";
import { settingsRoutes } from "./settings-routes.tsx";

/** After a screen change, keyboard and screen-reader users land on the new screen's title. */
function useFocusOnScreenChange(): void {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [pathname]);
}

function Waiting() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-screen place-items-center bg-bg">
      <Spinner label={t("auth.loading")} />
    </main>
  );
}

/** The backend can't be reached, so it isn't known who is signed in (AC-F01-29). */
function Unreachable({ code, onRetry }: { code: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const text = errorText(code);
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <Notice
        tone="danger"
        icon="signal"
        className="w-full max-w-95"
        action={{ label: t("auth.errors.retry"), onClick: onRetry }}
      >
        {t(text.key, text.values ?? {})}
      </Notice>
    </main>
  );
}

/** Where a visit goes back to, and where Join a meeting is: for guests, and for signed-in people. */
const GUEST_PLACES = { home: "/sign-in", join: "/join-meeting" };
const MEMBER_PLACES = { home: "/meetings", join: "/meetings" };

/** A visit to a meeting, signed in or as a guest (F02): pre-join, lobby, the call, and how it ended. */
function meetingRoutes({ home, join, userName }: { home: string; join: string; userName: string | undefined }) {
  return [
    <Route key="pre-join" path="/meeting/pre-join" element={<PreJoinRoute back={join} userName={userName} />} />,
    <Route key="lobby" path="/meeting/lobby" element={<LobbyRoute home={home} userName={userName} />} />,
    <Route key="call" path="/meeting/call" element={<CallRoute home={home} />} />,
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

function SignedOutRoutes() {
  const navigate = useNavigate();
  const preJoin = (state: PreJoinState) => void navigate("/meeting/pre-join", { state });
  return (
    <Routes>
      <Route
        path="/join-meeting"
        element={<JoinMeetingPage onFound={preJoin} onBack={() => void navigate("/sign-in")} />}
      />
      {meetingRoutes({ ...GUEST_PLACES, userName: undefined })}
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/code" element={<CodePage />} />
      <Route path="/new-password" element={<NewPasswordPage />} />
      <Route path="/browser-sign-in" element={<BrowserSignInPage />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  );
}

const PATHS: Record<AppScreen, string> = {
  home: "/",
  chat: "/chat",
  meetings: "/meetings",
  people: "/people",
  requests: "/requests",
  workspace: "/workspace-settings",
  settings: "/settings",
  join: "/join",
};

/** People and Requests exist only in company workspaces; elsewhere (e.g. after removal) Home opens. */
function CompanyOnly({ children }: { children: ReactNode }) {
  const { current } = useCurrentWorkspace();
  if (current && current.kind !== "company") return <Navigate to="/" replace />;
  return children;
}

function SignedInScreens() {
  const navigate = useNavigate();
  const { data: user } = useSession();
  const go = (screen: AppScreen) => void navigate(PATHS[screen]);
  const home = () => go("home");
  const settings = (screen: SettingsScreen) =>
    void navigate(screen === "profile" ? "/settings" : `/settings/${screen}`);
  const preJoin = (state: PreJoinState) => void navigate("/meeting/pre-join", { state });
  return (
    <Routes>
      <Route path="/" element={<HomePage onNavigate={go} />} />
      <Route path="/chat" element={<ChatsPage onNavigate={go} />} />
      <Route
        path="/call"
        element={
          <ChatCallPage
            onBackToChat={() => void navigate("/chat")}
            onLeft={() => void navigate("/chat")}
            onOutcome={(outcome) => void navigate("/meeting/ended", { state: outcome })}
          />
        }
      />
      <Route path="/meetings" element={<MeetingsPage onNavigate={go} onPreJoin={preJoin} />} />
      {meetingRoutes({ ...MEMBER_PLACES, userName: user?.name })}
      <Route
        path="/people"
        element={
          <CompanyOnly>
            <PeoplePage onNavigate={go} />
          </CompanyOnly>
        }
      />
      <Route
        path="/requests"
        element={
          <CompanyOnly>
            <RequestsPage onNavigate={go} />
          </CompanyOnly>
        }
      />
      <Route path="/workspace-settings" element={<WorkspaceSettingsPage onNavigate={go} />} />
      <Route path="/join" element={<JoinWorkspacePage onBack={home} />} />
      {settingsRoutes(settings, home)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** A call rings on every screen (AC-F15-05), and a call on another device shows (AC-F15-33). */
function Ringing() {
  const navigate = useNavigate();
  const toCall = () => void navigate("/call");
  return (
    <>
      <IncomingCalls onAccepted={toCall} />
      <OtherDevice onEntered={toCall} />
    </>
  );
}

function SignedInRoutes() {
  const { data: user } = useSession();
  useAccountLook(user);
  return (
    <CurrentWorkspaceProvider>
      {/* One live line while signed in (F14, D064). */}
      <LiveLineProvider>
        <Ringing />
        <SignedInScreens />
      </LiveLineProvider>
    </CurrentWorkspaceProvider>
  );
}

export function AppRoutes() {
  const session = useSession();
  useFocusOnScreenChange();
  if (session.isPending) return <Waiting />;
  if (session.isError) return <Unreachable code={session.error.code} onRetry={() => void session.refetch()} />;
  if (session.data === null) return <SignedOutRoutes />;
  if (!session.data.termsAccepted) return <TermsPage />;
  return <SignedInRoutes />;
}

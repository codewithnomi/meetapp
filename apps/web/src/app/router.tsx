// The screens and when each one shows (F01 design.md section 1): signed out, the sign-in screens; signed
// in but the terms not yet accepted, only Terms; signed in, the app. The desktop app has no address
// bar, so the routes live in memory. After a screen change, focus moves to the new screen's title.
import { Notice, Spinner } from "@meetapp/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { useAccountLook } from "../features/appearance/index.ts";
import { errorText, useSession } from "../features/auth/index.ts";
import type { SettingsScreen } from "../features/profile/index.ts";
import { CurrentWorkspaceProvider, useCurrentWorkspace, type AppScreen } from "../features/workspaces/index.ts";
import { BrowserSignInPage } from "../pages/BrowserSignInPage/index.ts";
import { CodePage } from "../pages/CodePage/index.ts";
import { CreateAccountPage } from "../pages/CreateAccountPage/index.ts";
import { IncomingCalls, OtherDevice } from "../features/calls/index.ts";
import { CallHost } from "./CallHost.tsx";
import { useCallWindows } from "../features/call-windows/index.ts";
import { useDesktopCommands } from "./desktop-commands.ts";
import { LiveLineProvider } from "../features/chats/index.ts";
import { ChatsPage } from "../pages/ChatsPage/index.ts";
import { HomePage } from "../pages/HomePage/index.ts";
import type { PreJoinState } from "../features/meetings/index.ts";
import { JoinMeetingPage } from "../pages/JoinMeetingPage/index.ts";
import { JoinWorkspacePage } from "../pages/JoinWorkspacePage/index.ts";
import { MeetingsPage } from "../pages/MeetingsPage/index.ts";
import { NewPasswordPage } from "../pages/NewPasswordPage/index.ts";
import { PeoplePage } from "../pages/PeoplePage/index.ts";
import { WorkspaceSettingsPage } from "../pages/WorkspaceSettingsPage/index.ts";
import { RequestsPage } from "../pages/RequestsPage/index.ts";
import { SignInPage } from "../pages/SignInPage/index.ts";
import { TermsPage } from "../pages/TermsPage/index.ts";
import { useFocusOnScreenChange } from "./focus.ts";
import { CallPlace, GUEST_PLACES, MEMBER_PLACES, meetingRoutes, memberMeetingRoutes } from "./meeting-routes.tsx";
import { settingsRoutes } from "./settings-routes.tsx";

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

function SignedOutRoutes() {
  const navigate = useNavigate();
  const preJoin = (state: PreJoinState) => void navigate("/meeting/pre-join", { state });
  // F04: signed out, a clicked meeting link opens Join a meeting as a guest (AC-F04-10).
  useDesktopCommands({ openJoin: () => void navigate("/join-meeting") });
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const go = (screen: AppScreen) => void navigate(PATHS[screen]);
  const home = () => go("home");
  const settings = (screen: SettingsScreen) =>
    void navigate(screen === "profile" ? "/settings" : `/settings/${screen}`);
  const preJoin = (state: PreJoinState) => void navigate("/meeting/pre-join", { state });
  useDesktopCommands({ openSettings: () => settings("profile"), openJoin: () => go("meetings") });
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage onNavigate={go} />} />
        <Route path="/chat" element={<ChatsPage onNavigate={go} />} />
        <Route path="/call" element={<CallPlace />} />
        <Route
          path="/meetings"
          element={<MeetingsPage onNavigate={go} onPreJoin={preJoin} onBackToCall={(path) => void navigate(path)} />}
        />
        {memberMeetingRoutes({ ...MEMBER_PLACES, userName: user?.name })}
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
      {/* F17: the call stays here while the person opens other screens (D091). */}
      <CallHost userName={user?.name ?? t("meetings.preJoin.you")} />
    </>
  );
}

/** A call rings on every screen (AC-F15-05), and a call on another device shows (AC-F15-33). */
function Ringing() {
  const navigate = useNavigate();
  const toCall = () => void navigate("/call");
  // F16: rings and the call also show in small windows above other apps (desktop app only).
  useCallWindows({ toCall, toChat: () => void navigate("/chat") });
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
  // Only when it was never known who is signed in: a failed check in the background (a window getting
  // focus on a busy computer) keeps the app as it is instead of rebuilding every screen.
  if (session.isError && session.data === undefined)
    return <Unreachable code={session.error.code} onRetry={() => void session.refetch()} />;
  if (!session.data) return <SignedOutRoutes />;
  if (!session.data.termsAccepted) return <TermsPage />;
  return <SignedInRoutes />;
}

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
import { HomePage } from "../pages/HomePage/index.ts";
import type { PreJoinState } from "../features/meetings/index.ts";
import { JoinMeetingPage } from "../pages/JoinMeetingPage/index.ts";
import { JoinWorkspacePage } from "../pages/JoinWorkspacePage/index.ts";
import { MeetingsPage } from "../pages/MeetingsPage/index.ts";
import { NewPasswordPage } from "../pages/NewPasswordPage/index.ts";
import { PeoplePage } from "../pages/PeoplePage/index.ts";
import { PreJoinPage } from "../pages/PreJoinPage/index.ts";
import { ProfilePage } from "../pages/ProfilePage/index.ts";
import { RequestsPage } from "../pages/RequestsPage/index.ts";
import { SettingsPage } from "../pages/SettingsPage/index.ts";
import { SignInPage } from "../pages/SignInPage/index.ts";
import { TermsPage } from "../pages/TermsPage/index.ts";

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

/** The pre-join screen, with the meeting handed over by the screen that found or made it (F02). */
function PreJoinRoute({ back }: { back: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <PreJoinPage meeting={location.state as PreJoinState | undefined} onCancel={() => void navigate(back)} />;
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
      <Route path="/meeting/pre-join" element={<PreJoinRoute back="/join-meeting" />} />
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
  meetings: "/meetings",
  people: "/people",
  requests: "/requests",
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
  const go = (screen: AppScreen) => void navigate(PATHS[screen]);
  const home = () => go("home");
  const settings = (screen: SettingsScreen) =>
    void navigate(screen === "profile" ? "/settings" : "/settings/appearance");
  const preJoin = (state: PreJoinState) => void navigate("/meeting/pre-join", { state });
  return (
    <Routes>
      <Route path="/" element={<HomePage onNavigate={go} />} />
      <Route path="/meetings" element={<MeetingsPage onNavigate={go} onPreJoin={preJoin} />} />
      <Route path="/meeting/pre-join" element={<PreJoinRoute back="/meetings" />} />
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
      <Route path="/join" element={<JoinWorkspacePage onBack={home} />} />
      <Route path="/settings" element={<ProfilePage onNavigate={settings} onBack={home} />} />
      <Route path="/settings/appearance" element={<SettingsPage onNavigate={settings} onBack={home} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function SignedInRoutes() {
  const { data: user } = useSession();
  useAccountLook(user);
  return (
    <CurrentWorkspaceProvider>
      <SignedInScreens />
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

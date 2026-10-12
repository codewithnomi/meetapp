// The screens and when each one shows (F01 design.md section 1): signed out, the sign-in screens; signed
// in but the terms not yet accepted, only Terms; signed in, the app. The desktop app has no address
// bar, so the routes live in memory. After a screen change, focus moves to the new screen's title.
import { Notice, Spinner } from "@meetapp/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { errorText, useSession } from "../features/auth/index.ts";
import { CurrentWorkspaceProvider } from "../features/workspaces/index.ts";
import { BrowserSignInPage } from "../pages/BrowserSignInPage/index.ts";
import { CodePage } from "../pages/CodePage/index.ts";
import { CreateAccountPage } from "../pages/CreateAccountPage/index.ts";
import { HomePage } from "../pages/HomePage/index.ts";
import { NewPasswordPage } from "../pages/NewPasswordPage/index.ts";
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

function SignedOutRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/code" element={<CodePage />} />
      <Route path="/new-password" element={<NewPasswordPage />} />
      <Route path="/browser-sign-in" element={<BrowserSignInPage />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  );
}

function SignedInRoutes() {
  const navigate = useNavigate();
  // "Join with a link or code" opens the Join screen (T15); until then it stays on Home.
  const home = <HomePage onOpenSettings={() => void navigate("/settings")} onJoin={() => void navigate("/join")} />;
  return (
    <CurrentWorkspaceProvider>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/settings" element={<SettingsPage onBack={() => void navigate("/")} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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

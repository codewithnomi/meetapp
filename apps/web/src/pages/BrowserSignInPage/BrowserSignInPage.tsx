// BrowserSignInPage (page): "Finish signing in in your browser" (F01 design.md section 2, AC-F01-07).
// Shows the 4-digit code the browser page shows too, and Cancel. When the browser is done the app is
// signed in; a cancel, an unverified email or a lock returns to Sign in with the reason.
import { AuthLayout, AuthTiles, Button, Spinner } from "@meetapp/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import { AuthHeading, useBrowserSignIn, type SignInProvider } from "../../features/auth/index.ts";

function Waiting({ provider }: { provider: SignInProvider }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useBrowserSignIn(provider);
  useEffect(() => {
    if (state.step === "failed") void navigate("/sign-in", { replace: true, state: { notice: state.code } });
  }, [state, navigate]);
  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("auth.browser.title")}>
        {t("auth.browser.body", { provider: t(`auth.browser.${provider}`) })}
      </AuthHeading>
      {state.step === "waiting" ? (
        <p
          aria-label={t("auth.browser.code")}
          className="m-0 font-mono text-[40px] leading-12 font-semibold tracking-[0.2em] text-ink"
        >
          {state.matchCode}
        </p>
      ) : null}
      <p role="status" className="m-0 flex items-center gap-2 text-body text-ink-muted">
        <Spinner />
        {state.step === "waiting" ? t("auth.browser.waiting") : t("auth.browser.starting")}
      </p>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => void navigate("/sign-in", { state: { notice: "SIGN_IN_CANCELLED" } })}
      >
        {t("auth.browser.cancel")}
      </Button>
      <p className="m-0 text-[13px] text-ink-muted">{t("auth.browser.help")}</p>
    </div>
  );
}

export function BrowserSignInPage() {
  const { t } = useTranslation();
  const provider = (useLocation().state as { provider?: SignInProvider } | null)?.provider;
  if (provider !== "google" && provider !== "microsoft") return <Navigate to="/sign-in" replace />;
  return (
    <AuthLayout
      brand={t("auth.brand")}
      aside={<AuthTiles headline={t("auth.tiles.headline")} description={t("auth.tiles.description")} />}
    >
      <Waiting provider={provider} />
    </AuthLayout>
  );
}

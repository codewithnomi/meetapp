// CodePage (page): the approved "Enter the code" screen (AC-F01-04, 06, 09). One screen for three
// purposes, named in the heading: confirm a new account, sign in without a password, or reset it.
// Six boxes (paste works), a countdown, and Send a new code (the old code then stops working).
import { AuthLayout, Button, CodeInput, Notice } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import {
  TEXT_LINK,
  ActionErrorNotice,
  AuthHeading,
  SubmitButton,
  type CodeScreenState,
} from "../../features/auth/index.ts";
import { useCodeActions } from "./code-actions.ts";
import { minutesAndSeconds, useCountdown } from "./useCountdown.ts";

const CODE_SECONDS = 15 * 60;
const TITLES = {
  signUp: "auth.code.titles.signUp",
  signIn: "auth.code.titles.signIn",
  reset: "auth.code.titles.reset",
} as const;

function CodeAside() {
  const { t } = useTranslation();
  return (
    <>
      <div
        aria-hidden="true"
        className="box-border flex w-full max-w-105 flex-col gap-2.5 self-start rounded-lg bg-stage-tile p-6"
      >
        <span className="text-[13px] opacity-75">{t("auth.code.asideFrom")}</span>
        <span className="font-mono text-[40px] leading-12 font-semibold tracking-[0.2em]">
          {t("auth.code.asideSample")}
        </span>
        <span className="text-[13px] opacity-75">{t("auth.code.asideRule")}</span>
      </div>
      <p className="m-0 max-w-105 text-body opacity-85">{t("auth.code.asideNote")}</p>
    </>
  );
}

function ResendRow({ pending, onResend }: { pending: boolean; onResend: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
      <span className="text-ink-muted">{t("auth.code.noEmail")}</span>
      <Button variant="ghost" size="sm" disabled={pending} onClick={onResend}>
        {t("auth.code.resend")}
      </Button>
    </div>
  );
}

function CodeForm({ state }: { state: CodeScreenState }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(0);
  const left = useCountdown(CODE_SECONDS, sent);
  const { confirm, resend } = useCodeActions(state);
  const submit = () => {
    if (code.length === 6 && left > 0) confirm.mutate(code);
  };
  const sendAgain = () => resend.mutate(undefined, { onSuccess: () => (setCode(""), setSent((count) => count + 1)) });
  return (
    <form noValidate className="flex flex-col gap-5.5" onSubmit={(event) => (event.preventDefault(), submit())}>
      <AuthHeading title={t(TITLES[state.purpose])}>
        {t("auth.code.sentBefore")} <strong className="font-semibold text-ink">{state.email}</strong>.{" "}
        {t("auth.code.sentAfter")}
      </AuthHeading>
      <CodeInput
        id="code"
        label={t("auth.code.label")}
        digitLabel={(position, length) => t("auth.code.digit", { position, length })}
        value={code}
        onChange={setCode}
        hint={left > 0 ? t("auth.code.hint", { time: minutesAndSeconds(left) }) : t("auth.code.expired")}
      />
      <SubmitButton
        label={t("auth.code.submit")}
        pendingLabel={t("auth.code.submitting")}
        pending={confirm.isPending}
        disabled={code.length !== 6 || left === 0}
      />
      <ActionErrorNotice error={confirm.error ?? resend.error} onRetry={submit} />
      {sent > 0 && !resend.error ? (
        <Notice tone="neutral" icon="check">
          {t("auth.code.resent")}
        </Notice>
      ) : null}
      <ResendRow pending={resend.isPending} onResend={sendAgain} />
      <Link
        to={state.purpose === "signUp" ? "/create-account" : "/sign-in"}
        className={`self-center text-[13px] ${TEXT_LINK}`}
      >
        {t("auth.code.differentEmail")}
      </Link>
    </form>
  );
}

export function CodePage() {
  const { t } = useTranslation();
  const state = useLocation().state as CodeScreenState | null;
  if (!state) return <Navigate to="/sign-in" replace />;
  return (
    <AuthLayout brand={t("auth.brand")} aside={<CodeAside />}>
      <CodeForm state={state} />
    </AuthLayout>
  );
}

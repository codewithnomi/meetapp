// The password step of SignInPage (approved "Sign in: password" screen): sign in, Forgot password? or
// Email me a code instead. A wrong password keeps the person here with "Email or password is wrong".
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar, Button, Input } from "@meetapp/ui";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  TEXT_LINK,
  ActionErrorNotice,
  AuthHeading,
  SubmitButton,
  authBridge,
  passwordForm,
  useAuthAction,
  useFieldError,
  type CodeScreenState,
} from "../../features/auth/index.ts";

/** Asks for a code and opens the code screen for it. */
function useCodeRequest(email: string) {
  const navigate = useNavigate();
  const request = useAuthAction((purpose: "sign-in" | "reset") => authBridge().requestCode(email, purpose));
  const ask = (purpose: "sign-in" | "reset") =>
    request.mutate(purpose, {
      onSuccess: () => {
        const state: CodeScreenState = { purpose: purpose === "reset" ? "reset" : "signIn", email };
        void navigate("/code", { state });
      },
    });
  return { ask, request };
}

/** The email being signed in, as a chip; pressing it goes back to change the email. */
function EmailChip({ email, onClick }: { email: string; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("auth.password.changeEmail", { email })}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border border-line-strong bg-transparent py-0 ps-2.5 pe-4 font-[inherit] text-[14px] font-[550] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <Avatar name={email} size="sm" />
      {email}
    </button>
  );
}

export function PasswordStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(passwordForm) });
  const signIn = useAuthAction((password: string) => authBridge().signInWithPassword(email, password));
  const { ask, request } = useCodeRequest(email);
  const busy = signIn.isPending || request.isPending;
  const error = signIn.error ?? request.error;
  const submit = handleSubmit(({ password }) => signIn.mutate(password));
  const passwordInput = register("password");
  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={submit}>
      <EmailChip email={email} onClick={onChangeEmail} />
      <AuthHeading title={t("auth.password.title")}>{t("auth.password.subtitle")}</AuthHeading>
      <Input
        id="password"
        label={t("auth.password.label")}
        type="password"
        autoComplete="current-password"
        {...passwordInput}
        {...fieldError(formState.errors.password)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ask("reset")}
        className={`-mt-2 self-end border-0 bg-transparent p-0 text-[13px] ${TEXT_LINK} cursor-pointer`}
      >
        {t("auth.password.forgot")}
      </button>
      <SubmitButton
        label={t("auth.password.submit")}
        pendingLabel={t("auth.password.submitting")}
        pending={signIn.isPending}
        disabled={busy}
      />
      <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={() => ask("sign-in")}>
        {t("auth.password.useCode")}
      </Button>
      <ActionErrorNotice error={error} onRetry={() => void submit()} />
    </form>
  );
}

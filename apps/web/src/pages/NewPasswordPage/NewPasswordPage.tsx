// NewPasswordPage (page): the approved "Choose a new password" screen (AC-F01-09). After the reset
// code: the new password twice, then Save and sign in. Every other device is signed out; this one
// stays signed in.
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout, AuthSteps, Input, Notice } from "@meetapp/ui";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import {
  TEXT_LINK,
  ActionErrorNotice,
  AuthHeading,
  SubmitButton,
  authBridge,
  newPasswordForm,
  useAuthAction,
  useFieldError,
  type NewPasswordState,
} from "../../features/auth/index.ts";

function ResetAside() {
  const { t } = useTranslation();
  return (
    <AuthSteps
      steps={[
        { title: t("auth.newPassword.steps.email"), state: "done" },
        { title: t("auth.newPassword.steps.code"), state: "done" },
        { title: t("auth.newPassword.steps.password"), state: "current" },
      ]}
      footer={t("auth.newPassword.steps.footer")}
    />
  );
}

function NewPasswordForm({ state }: { state: NewPasswordState }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(newPasswordForm) });
  const save = useAuthAction((password: string) => authBridge().resetPassword(state.email, state.code, password));
  const onSubmit = handleSubmit(({ password }) => save.mutate(password));
  const fields = { password: register("password"), repeat: register("repeat") };
  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={onSubmit}>
      <AuthHeading title={t("auth.newPassword.title")}>
        {t("auth.newPassword.forEmail", { email: state.email })}
      </AuthHeading>
      <Input
        id="reset-new"
        label={t("auth.newPassword.label")}
        type="password"
        autoComplete="new-password"
        hint={t("auth.newPassword.hint")}
        {...fields.password}
        {...fieldError(formState.errors.password)}
      />
      <Input
        id="reset-repeat"
        label={t("auth.newPassword.repeat")}
        type="password"
        autoComplete="new-password"
        {...fields.repeat}
        {...fieldError(formState.errors.repeat)}
      />
      <SubmitButton
        label={t("auth.newPassword.submit")}
        pendingLabel={t("auth.newPassword.submitting")}
        pending={save.isPending}
      />
      <ActionErrorNotice error={save.error} onRetry={() => void onSubmit()} />
      <Notice tone="neutral">{t("auth.newPassword.note")}</Notice>
      <Link to="/sign-in" className={`self-center text-[13px] ${TEXT_LINK}`}>
        {t("auth.newPassword.back")}
      </Link>
    </form>
  );
}

export function NewPasswordPage() {
  const { t } = useTranslation();
  const state = useLocation().state as NewPasswordState | null;
  if (!state) return <Navigate to="/sign-in" replace />;
  return (
    <AuthLayout brand={t("auth.brand")} aside={<ResetAside />}>
      <NewPasswordForm state={state} />
    </AuthLayout>
  );
}

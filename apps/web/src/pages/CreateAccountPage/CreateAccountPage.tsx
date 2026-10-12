// CreateAccountPage (page): the approved "Create account" screen (AC-F01-01, 03, 26). Email, name,
// password and the terms tick; then the code screen. The new account starts with this computer's
// theme and accent. Nothing is created until the emailed code is typed (AC-F01-04).
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout, AuthSteps, Input } from "@meetapp/ui";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { useAppearance } from "../../features/appearance/index.ts";
import {
  TEXT_LINK,
  ActionErrorNotice,
  AuthHeading,
  ProviderButtons,
  SubmitButton,
  TermsCheckbox,
  authBridge,
  createAccountForm,
  useAuthAction,
  useFieldError,
  type CodeScreenState,
  type SignUpForm,
} from "../../features/auth/index.ts";

function CreateAside() {
  const { t } = useTranslation();
  return (
    <AuthSteps
      steps={[
        { title: t("auth.create.steps.details"), description: t("auth.create.steps.detailsHint"), state: "current" },
        { title: t("auth.create.steps.confirm"), description: t("auth.create.steps.confirmHint"), state: "next" },
        { title: t("auth.create.steps.done"), description: t("auth.create.steps.doneHint"), state: "next" },
      ]}
      footer={t("auth.create.steps.footer")}
    />
  );
}

function HaveAccount() {
  const { t } = useTranslation();
  return (
    <p className="m-0 text-center text-[13px] text-ink-muted">
      {t("auth.create.haveAccount")}{" "}
      <Link to="/sign-in" className={TEXT_LINK}>
        {t("auth.create.signIn")}
      </Link>
    </p>
  );
}

/** Starts the sign-up with this computer's look, then opens the code screen. */
function useStartSignUp() {
  const navigate = useNavigate();
  const { theme, accent } = useAppearance();
  const start = useAuthAction((form: SignUpForm) => authBridge().startSignUp({ ...form, theme, accent }));
  const submit = (fields: { email: string; name: string; password: string }) => {
    const form = {
      email: fields.email.trim(),
      name: fields.name.trim(),
      password: fields.password,
      termsAccepted: true as const,
    };
    start.mutate(form, {
      onSuccess: ({ signupId }) => {
        const state: CodeScreenState = { purpose: "signUp", email: form.email, signupId: signupId ?? "" };
        void navigate("/code", { state });
      },
    });
  };
  return { start, submit };
}

export function CreateAccountPage() {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(createAccountForm) });
  const { start, submit } = useStartSignUp();
  const onSubmit = handleSubmit(submit);
  const fields = { email: register("email"), name: register("name"), password: register("password") };
  return (
    <AuthLayout brand={t("auth.brand")} aside={<CreateAside />}>
      <form noValidate className="flex flex-col gap-4.5" onSubmit={onSubmit}>
        <AuthHeading title={t("auth.create.title")}>{t("auth.create.subtitle")}</AuthHeading>
        <ProviderButtons dividerLabel={t("auth.providers.orEmail")} />
        <Input
          id="new-email"
          label={t("auth.create.email")}
          type="email"
          autoComplete="email"
          {...fields.email}
          {...fieldError(formState.errors.email)}
        />
        <Input
          id="new-name"
          label={t("auth.create.name")}
          autoComplete="name"
          hint={t("auth.create.nameHint")}
          {...fields.name}
          {...fieldError(formState.errors.name)}
        />
        <Input
          id="new-password"
          label={t("auth.create.password")}
          type="password"
          autoComplete="new-password"
          hint={t("auth.create.passwordHint")}
          {...fields.password}
          {...fieldError(formState.errors.password)}
        />
        <TermsCheckbox id="agree" field={register("terms")} error={fieldError(formState.errors.terms).error} />
        <SubmitButton
          label={t("auth.create.submit")}
          pendingLabel={t("auth.create.submitting")}
          pending={start.isPending}
        />
        <ActionErrorNotice error={start.error} onRetry={() => void onSubmit()} />
        <HaveAccount />
      </form>
    </AuthLayout>
  );
}

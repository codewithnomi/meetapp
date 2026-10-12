// TermsPage (page): after a first Google/Microsoft sign-in, the Terms, the Privacy Policy and the 16+
// statement must be accepted before anything else works (AC-F01-07; the backend enforces it too).
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout, AuthTiles } from "@meetapp/ui";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  ActionErrorNotice,
  AuthHeading,
  SubmitButton,
  TermsCheckbox,
  termsForm,
  useAcceptTerms,
  useFieldError,
} from "../../features/auth/index.ts";

export function TermsPage() {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(termsForm) });
  const accept = useAcceptTerms();
  const onSubmit = handleSubmit(() => accept.mutate());
  return (
    <AuthLayout
      brand={t("auth.brand")}
      aside={<AuthTiles headline={t("auth.tiles.headline")} description={t("auth.tiles.description")} />}
    >
      <form noValidate className="flex flex-col gap-5" onSubmit={onSubmit}>
        <AuthHeading title={t("auth.terms.title")}>{t("auth.terms.body")}</AuthHeading>
        <TermsCheckbox id="agree" field={register("agree")} error={fieldError(formState.errors.agree).error} />
        <SubmitButton
          label={t("auth.terms.submit")}
          pendingLabel={t("auth.terms.submitting")}
          pending={accept.isPending}
        />
        <ActionErrorNotice error={accept.error} onRetry={() => void onSubmit()} />
      </form>
    </AuthLayout>
  );
}

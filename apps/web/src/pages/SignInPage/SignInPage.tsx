// SignInPage (page): the approved "Sign in" and "Sign in: password" screens (AC-F01-05, 06, 09). The
// email comes first; the password step always follows, whether or not the email has an account, so
// the screen never tells which emails are registered. From there: sign in, a code instead, or reset.
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout, AuthTiles, Button, Input } from "@meetapp/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { TEXT_LINK, AuthHeading, emailForm, useFieldError } from "../../features/auth/index.ts";
import { PasswordStep } from "./PasswordStep.tsx";

function EmailStep({ initial, onContinue }: { initial: string; onContinue: (email: string) => void }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(emailForm),
    defaultValues: { email: initial },
  });
  const emailInput = register("email");
  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={handleSubmit(({ email }) => onContinue(email.trim()))}>
      <AuthHeading title={t("auth.signIn.title")}>{t("auth.signIn.subtitle")}</AuthHeading>
      <Input
        id="email"
        label={t("auth.signIn.email")}
        type="email"
        autoComplete="email"
        placeholder={t("auth.signIn.placeholder")}
        {...emailInput}
        {...fieldError(formState.errors.email)}
      />
      <Button type="submit" size="lg" className="w-full">
        {t("auth.signIn.continue")}
      </Button>
      <p className="m-0 text-center text-[13px] text-ink-muted">
        {t("auth.signIn.newHere")}{" "}
        <Link to="/create-account" className={TEXT_LINK}>
          {t("auth.signIn.createAccount")}
        </Link>
      </p>
      <p className="m-0 text-center text-[12px] leading-4 text-ink-muted">{t("auth.signIn.legal")}</p>
    </form>
  );
}

export function SignInPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState<string | null>(null);
  const initial = (location.state as { email?: string } | null)?.email ?? "";
  return (
    <AuthLayout
      brand={t("auth.brand")}
      aside={<AuthTiles headline={t("auth.tiles.headline")} description={t("auth.tiles.description")} />}
    >
      {email === null ? (
        <EmailStep initial={initial} onContinue={setEmail} />
      ) : (
        <PasswordStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
    </AuthLayout>
  );
}

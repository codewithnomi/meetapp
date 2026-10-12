// Turns a form field's rule message (a text key from forms.ts) into the `error` prop of an input.
import type { FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";

type ValidationKey =
  `auth.validation.${"email" | "name" | "passwordShort" | "passwordLong" | "passwordsDiffer" | "terms" | "code"}`;

/** `{ error: "…" }` when the field broke a rule, else `{}` (so it can be spread onto an Input). */
export function useFieldError() {
  const { t } = useTranslation();
  return (error: FieldError | undefined): { error?: string } =>
    error?.message ? { error: t(error.message as ValidationKey) } : {};
}

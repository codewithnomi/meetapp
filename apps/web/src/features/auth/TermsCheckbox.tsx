// "I agree to the Terms and the Privacy Policy, and I am 16 or older." (approved Create account screen,
// AC-F01-01, 07). A native checkbox in the accent color; a missing tick says how to fix it.
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

export interface TermsCheckboxProps {
  id: string;
  field: UseFormRegisterReturn;
  error?: string | undefined;
}

export function TermsCheckbox({ id, field, error }: TermsCheckboxProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[14px] leading-5 text-ink">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="m-0 size-5 flex-none accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          {...field}
        />
        <span>{t("auth.create.terms")}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="m-0 ps-8 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Input (atom): a pill-shaped single-line text field with its label, hint and error message, all
// connected for screen readers. The error replaces the hint and marks the field invalid.
import type { InputHTMLAttributes } from "react";
import { cx } from "../../lib/cx.ts";
import { Icon, type IconName } from "../Icon/index.ts";

interface InputBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size"> {
  /** Unique on the page; the label, hint and error are linked through it. */
  id: string;
  hint?: string;
  /** Says what went wrong and how to fix it. */
  error?: string;
  icon?: IconName;
  /** Classes for the whole field (label + input + message). */
  className?: string;
}

/** A visible `label` (translated), or for an obvious field such as search, an `aria-label` instead. */
export type InputProps = InputBaseProps & ({ label: string } | { label?: undefined; "aria-label": string });

/** The error, or else the hint, below the field; lined up with the text inside it. */
function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string | undefined;
  error: string | undefined;
  hint: string | undefined;
}) {
  const text = error || hint;
  if (!text) return null;
  return (
    <p id={id} className={cx("m-0 px-4 text-[12px] leading-4", error ? "font-medium text-danger" : "text-ink-muted")}>
      {text}
    </p>
  );
}

export function Input({
  id,
  label,
  hint,
  error,
  icon,
  className,
  "aria-describedby": describedBy,
  ...rest
}: InputProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="px-4 text-[13px] font-[550] leading-4.5 text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <Icon
            name={icon}
            size={18}
            className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-ink-muted"
          />
        ) : null}
        <input
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(describedBy, messageId) || undefined}
          className={cx(
            "box-border h-10 w-full rounded-full border bg-surface-sunken px-4 font-[inherit] text-ink placeholder:text-ink-subtle",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Fields use a 1px outline offset (design system), not FOCUS_RING's 2px.
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring",
            // With an error the red border stays while focused (design system); otherwise the outline replaces it.
            error ? "border-danger" : "border-line-strong focus-visible:border-transparent",
            icon && "ps-10.5",
          )}
        />
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

// Button (atom): the standard pill-shaped action button. Primary follows the user's accent color and
// uses on-accent text (dark on sky, orange, green and teal). While `loading` it keeps its size,
// shows a spinner and can't be pressed again.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { Icon, type IconName } from "../Icon/index.ts";
import { Spinner } from "../Spinner/index.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** A verb-first label: "Start meeting", never "OK". */
  children: ReactNode;
}

/** While loading, screen readers must hear what is happening, so `loadingLabel` is then required. */
export type ButtonProps =
  | (ButtonBaseProps & { loading?: false; loadingLabel?: never })
  | (ButtonBaseProps & { loading: true; loadingLabel: string });

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-on-accent enabled:hover:brightness-94",
  secondary: "bg-surface text-ink border-line-strong enabled:hover:bg-surface-sunken",
  ghost: "border-transparent bg-transparent text-accent-text enabled:hover:bg-accent-soft",
  danger: "border-transparent bg-danger-fill text-on-danger-fill enabled:hover:brightness-93",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-4 text-[13px]",
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cx(
        // Each variant sets exactly one border color; two would compete and the wrong one could win.
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border",
        "font-semibold leading-none transition-[background-color,border-color,filter] duration-120",
        "disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
        VARIANTS[variant],
        SIZES[size],
        loading && "cursor-progress disabled:cursor-progress disabled:opacity-85",
        className,
      )}
    >
      {loading ? <Spinner size={16} {...(loadingLabel ? { label: loadingLabel } : {})} /> : null}
      {!loading && icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

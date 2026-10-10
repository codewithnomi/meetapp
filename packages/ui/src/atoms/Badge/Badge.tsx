// Badge (atom): one or two words of status next to a name or title. The tone carries meaning, and the
// words are always there, so it never relies on color alone.
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";
import { Icon, type IconName } from "../Icon/index.ts";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  /** The words, already translated. */
  children: ReactNode;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex h-5.5 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-[12px] font-semibold leading-none",
        TONES[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

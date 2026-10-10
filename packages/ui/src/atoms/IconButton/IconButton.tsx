// IconButton (atom): a round icon-only button for meeting controls. Its required `label` is shown as a
// tooltip and read by screen readers. `active` = a feature is on (accent); `off` = microphone or camera
// is off (danger-soft). Uses the Icon and Tooltip atoms through their public entry points.
import type { ButtonHTMLAttributes } from "react";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { Icon, type IconName } from "../Icon/index.ts";
import { Tooltip } from "../Tooltip/index.ts";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: IconName;
  /** The action that will happen, already translated: "Mute" when on, "Unmute" when off. */
  label: string;
  variant?: "control" | "ghost";
  active?: boolean;
  off?: boolean;
  /** A count shown on the corner, e.g. unread messages. It is hidden from screen readers, so `label`
   * must include it ("Chat, 3 unread"). */
  badge?: number;
  /** md = 44px (meeting controls), sm = 34px (dense lists). */
  size?: "sm" | "md";
  /** Set false to drop the tooltip (e.g. when a visible label sits next to it). */
  tooltip?: boolean;
}

const VARIANTS = {
  control: "bg-surface-raised text-ink border-line-strong hover:bg-surface-sunken",
  ghost: "border-transparent bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
};

function stateClasses(variant: "control" | "ghost", active: boolean, off: boolean): string {
  if (active) return "bg-accent text-on-accent border-transparent";
  if (off) return "bg-danger-soft text-danger border-transparent";
  return VARIANTS[variant];
}

export function IconButton({
  icon,
  label,
  variant = "control",
  active,
  off,
  badge,
  size = "md",
  tooltip = true,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const pressed = active === undefined && off === undefined ? undefined : active === true || off === true;
  const button = (
    <button
      {...rest}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "relative inline-grid cursor-pointer place-items-center rounded-full border transition-colors duration-120",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "size-11" : "size-8.5",
        stateClasses(variant, active === true, off === true),
        FOCUS_RING,
        className,
      )}
    >
      <Icon name={icon} size={size === "sm" ? 18 : 22} />
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.75 -right-0.75 box-border h-4.5 min-w-4.5 rounded-full bg-accent px-1.25 text-center text-[11px] font-bold leading-4.5 text-on-accent"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
  return tooltip ? <Tooltip label={label}>{button}</Tooltip> : button;
}

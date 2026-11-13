// StatusDot (atom): a person's status as a small dot on the corner of their picture (approved canvas
// "Chats (F14)", AC-F14-26): Available green, Away amber, In a call red, Offline an empty ring; set by
// hand (F04 AC-F04-20, as in Teams): Busy red, Do not disturb red with a white bar, Be right back amber.
// The colour is never the only sign: the dot carries the status word for screen readers.
import { cx } from "../../lib/cx.ts";

export type ChatStatus = "available" | "away" | "in_call" | "offline" | "busy" | "dnd" | "brb";

export interface StatusDotProps {
  status: ChatStatus;
  /** Already translated: "Available", "Away", "In a call", "Busy", "Do not disturb", …; empty when the
   * word is already written next to the dot (the dot is then hidden from screen readers). */
  label: string;
  /** Sits on the corner of an avatar (the avatar's wrapper is `relative`). */
  placed?: boolean;
  className?: string;
}

const COLORS: Record<ChatStatus, string> = {
  available: "bg-success",
  away: "bg-warning",
  in_call: "bg-danger",
  offline: "bg-surface shadow-[inset_0_0_0_2px_var(--ink-subtle)]",
  busy: "bg-danger",
  dnd: "bg-danger",
  brb: "bg-warning",
};

export function StatusDot({ status, label, placed = false, className }: StatusDotProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-status={status}
      className={cx(
        "box-border flex size-3 items-center justify-center rounded-full border-2 border-surface",
        COLORS[status],
        placed && "absolute -right-px -bottom-px",
        className,
      )}
    >
      {status === "dnd" && <span className="block h-0.5 w-1 rounded-full bg-surface" />}
    </span>
  );
}

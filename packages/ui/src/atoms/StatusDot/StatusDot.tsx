// StatusDot (atom): a person's status as a small dot on the corner of their picture (approved canvas
// "Chats (F14)", AC-F14-26): Available green, Away amber, In a meeting red, Offline an empty ring. The
// colour is never the only sign: the dot carries the status word for screen readers.
import { cx } from "../../lib/cx.ts";

export type ChatStatus = "available" | "away" | "in_meeting" | "offline";

export interface StatusDotProps {
  status: ChatStatus;
  /** Already translated: "Available", "Away", "In a meeting", "Offline". */
  label: string;
  /** Sits on the corner of an avatar (the avatar's wrapper is `relative`). */
  placed?: boolean;
  className?: string;
}

const COLORS: Record<ChatStatus, string> = {
  available: "bg-success",
  away: "bg-warning",
  in_meeting: "bg-danger",
  offline: "bg-surface shadow-[inset_0_0_0_2px_var(--ink-subtle)]",
};

export function StatusDot({ status, label, placed = false, className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      data-status={status}
      className={cx(
        "box-border block size-3 rounded-full border-2 border-surface",
        COLORS[status],
        placed && "absolute -right-px -bottom-px",
        className,
      )}
    />
  );
}

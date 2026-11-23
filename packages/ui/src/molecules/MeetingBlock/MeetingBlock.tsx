// MeetingBlock (molecule): one meeting in the calendar (approved "Calendar" screen, F13). Accepted and
// no-answer meetings are filled, Maybe is outlined and striped, Declined is dimmed and struck through but
// still there, a cancelled one is greyed. A series shows the repeat icon. The spoken name reads the title,
// the time and the person's answer. All words arrive as props.
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export type MeetingBlockState = "accepted" | "none" | "tentative" | "declined" | "cancelled";

export interface MeetingBlockProps {
  title: string;
  /** Already formatted: "10:00 – 10:30". */
  time: string;
  state: MeetingBlockState;
  /** Translated answer for screen readers: "Accepted", "Maybe", "Declined", "No answer", "Cancelled". */
  stateLabel: string;
  /** Part of a series. */
  repeats?: boolean;
  /** Short blocks show the title only. */
  compact?: boolean;
  onOpen: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const LOOK: Record<MeetingBlockState, string> = {
  accepted: "border-l-accent bg-accent-soft text-ink",
  none: "border-l-accent bg-accent-soft text-ink",
  tentative:
    "border-l-accent bg-surface text-ink bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--accent-soft)_6px_9px)]",
  declined: "border-l-line-strong bg-surface-sunken text-ink-muted line-through",
  cancelled: "border-l-line-strong bg-surface-sunken text-ink-muted",
};

export function MeetingBlock(props: MeetingBlockProps) {
  const { title, time, state, stateLabel, repeats, compact, onOpen, className, style } = props;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${title}, ${time}, ${stateLabel}`}
      data-state={state}
      style={style}
      className={cx(
        "flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-sm border-0 border-l-3 px-2 py-1 text-left font-[inherit] text-[12px] leading-4 hover:brightness-95",
        LOOK[state],
        FOCUS_RING,
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1 font-semibold">
        <span className="truncate">{title}</span>
        {repeats ? <Icon name="repeat" size={12} className="flex-none" /> : null}
      </span>
      {compact ? null : <span className="truncate">{time}</span>}
    </button>
  );
}

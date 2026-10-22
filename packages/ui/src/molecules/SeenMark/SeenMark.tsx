// SeenMark (molecule): "Seen" under the sender's last message (AC-F14-24). In a group of up to 20, hovering
// or focusing it lists who has seen it.
import { Tooltip } from "../../atoms/Tooltip/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface SeenMarkProps {
  /** "Seen". */
  label: string;
  /** Groups: "Seen by Sara Malik, Omar Farooq". */
  seenBy?: string | undefined;
}

export function SeenMark({ label, seenBy }: SeenMarkProps) {
  const mark = <span className="text-[12px] font-medium text-ink-muted">{label}</span>;
  if (!seenBy) return <p className="m-0 self-end">{mark}</p>;
  return (
    <p className="m-0 self-end">
      <Tooltip label={seenBy}>
        <button type="button" aria-label={seenBy} className={cx("rounded-sm bg-transparent p-0", FOCUS_RING)}>
          {mark}
        </button>
      </Tooltip>
    </p>
  );
}

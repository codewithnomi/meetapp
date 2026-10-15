// LevelMeter (atom): how loud the microphone is, as ten bars that grow left to right, from the approved
// "Pre-join" and "Device settings" screens. The filled bars use the accent; screen readers hear it as a
// meter from 0 to 10 named by `label`.
import { cx } from "../../lib/cx.ts";

export interface LevelMeterProps {
  /** 0 (silent) to 10 (loud); rounded and kept in range. */
  level: number;
  /** Already translated: "Microphone level". */
  label: string;
  className?: string;
}

const BARS = 10;
/** Heights 7 to 16 px, as drawn in the design. */
const HEIGHTS = ["h-[7px]", "h-2", "h-[9px]", "h-2.5", "h-[11px]", "h-3", "h-[13px]", "h-3.5", "h-[15px]", "h-4"];

export function LevelMeter({ level, label, className }: LevelMeterProps) {
  const value = Math.min(BARS, Math.max(0, Math.round(Number.isFinite(level) ? level : 0)));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={BARS}
      aria-valuenow={value}
      className={cx("flex h-5 items-end gap-0.75", className)}
    >
      {HEIGHTS.map((height, index) => (
        <span
          // The bars never move or change count, so their position is a stable key.
          key={index}
          aria-hidden="true"
          className={cx("w-1.5 rounded-[3px]", height, index < value ? "bg-accent" : "bg-line-strong")}
        />
      ))}
    </div>
  );
}

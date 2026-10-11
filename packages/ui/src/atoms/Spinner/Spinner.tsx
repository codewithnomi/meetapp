// Spinner (atom): a small loading indicator in the surrounding text color. With a `label` it is
// announced to screen readers ("Connecting"); without one it is decorative.
import { cx } from "../../lib/cx.ts";

export interface SpinnerProps {
  /** Pixels; default 20. */
  size?: number;
  /** What is loading, already translated. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 20, label, className }: SpinnerProps) {
  // A live region announces the text inside it, so the label is real (visually hidden) text, not aria-label.
  const a11y = label ? { role: "status" } : { "aria-hidden": true };
  return (
    <span
      {...a11y}
      className={cx(
        "inline-block shrink-0 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-r-transparent opacity-85",
        "motion-reduce:[animation-duration:2.4s]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

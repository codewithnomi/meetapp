// Icon (atom): a line icon drawn in the surrounding text color. Hidden from screen readers unless it
// carries meaning on its own, then `label` names it.
import { cx } from "../../lib/cx.ts";
import { ICONS, type IconName } from "./icons.ts";

export interface IconProps {
  name: IconName;
  /** Pixels; default 20. */
  size?: number;
  /** Only when the icon alone carries meaning (e.g. a muted microphone). */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  const Glyph = ICONS[name];
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <Glyph className={cx("block shrink-0", className)} size={size} strokeWidth={1.75} focusable="false" {...a11y} />
  );
}

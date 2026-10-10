// Avatar (atom): a person's photo, or their initials on the accent tint. While they speak a green ring
// shows, and the accessible label says so too, so the state never relies on color alone.
import { cx } from "../../lib/cx.ts";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarBaseProps {
  /** Used for the initials and, when not speaking, the accessible label. */
  name: string;
  src?: string;
  /** sm 28px, md 36px, lg 48px, xl 88px (inside a video tile with the camera off). */
  size?: AvatarSize;
  className?: string;
}

/** While speaking, `speakingLabel` (translated, e.g. "Aisha Khan, speaking") is required. */
export type AvatarProps =
  | (AvatarBaseProps & { speaking?: false; speakingLabel?: never })
  | (AvatarBaseProps & { speaking: true; speakingLabel: string });

const SIZES: Record<AvatarSize, string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-[13px]",
  lg: "size-12 text-[16px]",
  xl: "size-22 text-[28px]",
};

/** "aisha khan" → "AK": the first letter of the first two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => (Array.from(word)[0] ?? "").toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = "md", speaking = false, speakingLabel, className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={speaking && speakingLabel ? speakingLabel : name}
      className={cx(
        "inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full bg-accent-soft font-[650] text-accent-text",
        SIZES[size],
        speaking && "ring-3 ring-speaking ring-offset-2 ring-offset-bg",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}

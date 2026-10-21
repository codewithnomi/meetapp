// Sticker (atom): one of MeetApp's own stickers (F03 AC-F03-26): a bold word card drawn by the app
// itself, so no outside service is involved. The words arrive translated; the sticker's name picks
// its look. Screen readers hear "Sticker: Thank you".
import { Icon, type IconName } from "../Icon/index.ts";
import { cx } from "../../lib/cx.ts";

const LOOKS: Record<string, { icon: IconName; tone: string }> = {
  "thank-you": { icon: "sparkle", tone: "bg-accent-soft text-accent-text" },
  "great-job": { icon: "check", tone: "bg-success-soft text-success" },
  "on-my-way": { icon: "chevron", tone: "bg-accent-soft text-accent-text" },
  "be-right-back": { icon: "clock", tone: "bg-warning-soft text-warning" },
  agreed: { icon: "check", tone: "bg-success-soft text-success" },
  coffee: { icon: "smile", tone: "bg-warning-soft text-warning" },
  "ship-it": { icon: "send", tone: "bg-accent-soft text-accent-text" },
  welcome: { icon: "users", tone: "bg-accent-soft text-accent-text" },
};
const DEFAULT_LOOK = { icon: "smile" as IconName, tone: "bg-surface-sunken text-ink" };

export interface StickerProps {
  name: string;
  /** "Thank you" (translated). */
  text: string;
  /** "Sticker: Thank you". */
  label: string;
  size?: "sm" | "md";
}

export function Sticker({ name, text, label, size = "md" }: StickerProps) {
  const look = LOOKS[name] ?? DEFAULT_LOOK;
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        "inline-flex flex-col items-center justify-center gap-1 rounded-lg font-bold",
        look.tone,
        size === "md" ? "size-28 text-[15px]" : "h-18 w-full text-[12px]",
      )}
    >
      <Icon name={look.icon} size={size === "md" ? 32 : 20} />
      <span aria-hidden="true" className="px-1 text-center leading-4">
        {text}
      </span>
    </span>
  );
}
